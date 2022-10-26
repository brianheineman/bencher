use std::convert::TryFrom;

use async_trait::async_trait;
use bencher_json::{
    member::{JsonNewMember, JsonOrganizationRole},
    ResourceId,
};
use email_address_parser::EmailAddress;

use crate::{
    bencher::{backend::Backend, wide::Wide},
    cli::member::{CliMemberInvite, CliMemberRole},
    CliError,
};

use super::SubCmd;

#[derive(Debug, Clone)]
pub struct Invite {
    org: ResourceId,
    name: Option<String>,
    email: EmailAddress,
    role: JsonOrganizationRole,
    backend: Backend,
}

impl TryFrom<CliMemberInvite> for Invite {
    type Error = CliError;

    fn try_from(invite: CliMemberInvite) -> Result<Self, Self::Error> {
        let CliMemberInvite {
            org,
            name,
            email,
            role,
            backend,
        } = invite;
        Ok(Self {
            org,
            name,
            email: EmailAddress::parse(&email, None).ok_or(CliError::Email(email))?,
            role: role.into(),
            backend: backend.try_into()?,
        })
    }
}

impl From<CliMemberRole> for JsonOrganizationRole {
    fn from(role: CliMemberRole) -> Self {
        match role {
            CliMemberRole::Member => Self::Member,
            CliMemberRole::Leader => Self::Leader,
        }
    }
}

impl From<Invite> for JsonNewMember {
    fn from(invite: Invite) -> Self {
        let Invite {
            org: _,
            name,
            email,
            role,
            backend: _,
        } = invite;
        Self {
            name,
            email: email.to_string(),
            role,
        }
    }
}

#[async_trait]
impl SubCmd for Invite {
    async fn exec(&self, _wide: &Wide) -> Result<(), CliError> {
        let invite: JsonNewMember = self.clone().into();
        self.backend
            .post(&format!("/v0/organizations/{}/members", &self.org), &invite)
            .await?;
        Ok(())
    }
}
