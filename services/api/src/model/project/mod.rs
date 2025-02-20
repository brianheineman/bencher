use std::string::ToString;

use bencher_json::{
    project::{JsonProjectPatch, JsonProjectPatchNull, JsonUpdateProject, Visibility},
    DateTime, JsonNewProject, JsonProject, ProjectUuid, ResourceId, ResourceName, Slug, Url,
};
use bencher_rbac::{project::Permission, Organization, Project};
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl};
use dropshot::HttpError;

use crate::{
    context::{DbConnection, Rbac},
    error::{
        assert_parentage, forbidden_error, resource_not_found_error, unauthorized_error,
        BencherResource,
    },
    model::{organization::QueryOrganization, user::auth::AuthUser},
    schema::{self, project as project_table},
    util::{
        fn_get::{fn_get, fn_get_uuid},
        resource_id::{fn_eq_resource_id, fn_from_resource_id},
        slug::ok_slug,
    },
};

use super::organization::OrganizationId;

pub mod benchmark;
pub mod branch;
pub mod measure;
pub mod metric;
pub mod metric_boundary;
pub mod plot;
pub mod project_role;
pub mod report;
pub mod testbed;
pub mod threshold;

crate::util::typed_id::typed_id!(ProjectId);

#[derive(
    Debug, Clone, diesel::Queryable, diesel::Identifiable, diesel::Associations, diesel::Selectable,
)]
#[diesel(table_name = project_table)]
#[diesel(belongs_to(QueryOrganization, foreign_key = organization_id))]
pub struct QueryProject {
    pub id: ProjectId,
    pub uuid: ProjectUuid,
    pub organization_id: OrganizationId,
    pub name: ResourceName,
    pub slug: Slug,
    pub url: Option<Url>,
    pub visibility: Visibility,
    pub created: DateTime,
    pub modified: DateTime,
}

impl QueryProject {
    fn_eq_resource_id!(project);
    fn_from_resource_id!(project, Project, true);

    fn_get!(project, ProjectId);
    fn_get_uuid!(project, ProjectId, ProjectUuid);

    pub fn is_public(&self) -> bool {
        self.visibility.is_public()
    }

    #[cfg(not(feature = "plus"))]
    pub fn is_visibility_public(visibility: Visibility) -> Result<(), HttpError> {
        visibility
            .is_public()
            .then_some(())
            .ok_or(crate::error::payment_required_error(format!(
                "Private projects are only available with the an active Bencher Plus plan. Please upgrade your plan at: https://bencher.dev/pricing"
            )))
    }

    pub fn is_allowed(
        conn: &mut DbConnection,
        rbac: &Rbac,
        project: &ResourceId,
        auth_user: &AuthUser,
        permission: Permission,
    ) -> Result<Self, HttpError> {
        // Do not leak information about private projects.
        // Always return the same error.
        Self::is_allowed_inner(conn, rbac, project, auth_user, permission)
            .map_err(|_e| resource_not_found_error(BencherResource::Project, project, permission))
    }

    fn is_allowed_inner(
        conn: &mut DbConnection,
        rbac: &Rbac,
        project: &ResourceId,
        auth_user: &AuthUser,
        permission: Permission,
    ) -> Result<Self, HttpError> {
        let query_project = Self::from_resource_id(conn, project)?;
        rbac.is_allowed_project(auth_user, permission, &query_project)
            .map_err(forbidden_error)?;
        Ok(query_project)
    }

    pub fn is_allowed_public(
        conn: &mut DbConnection,
        rbac: &Rbac,
        project: &ResourceId,
        auth_user: Option<&AuthUser>,
    ) -> Result<Self, HttpError> {
        // Do not leak information about private projects.
        // Always return the same error.
        Self::is_allowed_public_inner(conn, rbac, project, auth_user).map_err(|_e| {
            resource_not_found_error(BencherResource::Project, project, Permission::View)
        })
    }

    fn is_allowed_public_inner(
        conn: &mut DbConnection,
        rbac: &Rbac,
        project: &ResourceId,
        auth_user: Option<&AuthUser>,
    ) -> Result<Self, HttpError> {
        let query_project = Self::from_resource_id(conn, project)?;
        // Check to see if the project is public
        // If so, anyone can access it
        if query_project.is_public() {
            Ok(query_project)
        } else if let Some(auth_user) = auth_user {
            // If there is an `AuthUser` then validate access
            // Verify that the user is allowed
            rbac.is_allowed_project(auth_user, Permission::View, &query_project)
                .map_err(forbidden_error)?;
            Ok(query_project)
        } else {
            Err(unauthorized_error(project))
        }
    }

    #[cfg(feature = "plus")]
    pub fn perf_url(&self, console_url: &url::Url) -> Result<Option<url::Url>, HttpError> {
        if !self.is_public() {
            return Ok(None);
        }
        let path = format!("/perf/{}", self.slug);
        console_url
            .join(&path)
            .map_err(|e| {
                crate::error::issue_error(
                    "Failed to create new perf URL.",
                    &format!("Failed to create new perf URL for {console_url} at {path}",),
                    e,
                )
            })
            .map(Some)
    }

    pub fn into_json(self, conn: &mut DbConnection) -> Result<JsonProject, HttpError> {
        let query_organization = QueryOrganization::get(conn, self.organization_id)?;
        Ok(self.into_json_for_organization(&query_organization))
    }

    pub fn into_json_for_organization(self, organization: &QueryOrganization) -> JsonProject {
        let Self {
            uuid,
            organization_id,
            name,
            slug,
            url,
            visibility,
            created,
            modified,
            ..
        } = self;
        assert_parentage(
            BencherResource::Organization,
            organization.id,
            BencherResource::Project,
            organization_id,
        );
        JsonProject {
            uuid,
            organization: organization.uuid,
            name,
            slug,
            url,
            visibility,
            created,
            modified,
        }
    }
}

#[derive(Debug, diesel::Insertable)]
#[diesel(table_name = project_table)]
pub struct InsertProject {
    pub uuid: ProjectUuid,
    pub organization_id: OrganizationId,
    pub name: ResourceName,
    pub slug: Slug,
    pub url: Option<Url>,
    pub visibility: Visibility,
    pub created: DateTime,
    pub modified: DateTime,
}

impl InsertProject {
    pub fn from_json(
        conn: &mut DbConnection,
        organization: &QueryOrganization,
        project: JsonNewProject,
    ) -> Result<Self, HttpError> {
        let JsonNewProject {
            name,
            slug,
            url,
            visibility,
        } = project;
        let slug = ok_slug!(conn, &name, slug, project, QueryProject)?;
        let timestamp = DateTime::now();
        Ok(Self {
            uuid: ProjectUuid::new(),
            organization_id: organization.id,
            name,
            slug,
            url,
            visibility: visibility.unwrap_or_default(),
            created: timestamp,
            modified: timestamp,
        })
    }
}

#[derive(Debug, Clone, diesel::AsChangeset)]
#[diesel(table_name = project_table)]
pub struct UpdateProject {
    pub name: Option<ResourceName>,
    pub slug: Option<Slug>,
    pub url: Option<Option<Url>>,
    pub visibility: Option<Visibility>,
    pub modified: DateTime,
}

impl From<JsonUpdateProject> for UpdateProject {
    fn from(update: JsonUpdateProject) -> Self {
        match update {
            JsonUpdateProject::Patch(patch) => {
                let JsonProjectPatch {
                    name,
                    slug,
                    url,
                    visibility,
                } = patch;
                Self {
                    name,
                    slug,
                    url: url.map(Some),
                    visibility,
                    modified: DateTime::now(),
                }
            },
            JsonUpdateProject::Null(patch_url) => {
                let JsonProjectPatchNull {
                    name,
                    slug,
                    url: (),
                    visibility,
                } = patch_url;
                Self {
                    name,
                    slug,
                    url: Some(None),
                    visibility,
                    modified: DateTime::now(),
                }
            },
        }
    }
}

impl From<&InsertProject> for Organization {
    fn from(project: &InsertProject) -> Self {
        Organization {
            id: project.organization_id.to_string(),
        }
    }
}

impl From<&QueryProject> for Organization {
    fn from(project: &QueryProject) -> Self {
        Organization {
            id: project.organization_id.to_string(),
        }
    }
}

impl From<&QueryProject> for Project {
    fn from(project: &QueryProject) -> Self {
        Project {
            id: project.id.to_string(),
            organization_id: project.organization_id.to_string(),
        }
    }
}
