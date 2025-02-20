import * as Sentry from "@sentry/astro";
import { createMemo, createResource } from "solid-js";
import type { JsonOrganization, JsonProject } from "../../../types/bencher";
import { authUser, removeUser } from "../../../util/auth";
import { httpGet } from "../../../util/http";
import {
	NOTIFY_KIND_PARAM,
	NOTIFY_TEXT_PARAM,
	NotifyKind,
	forwardParams,
	navigateNotify,
} from "../../../util/notify";
import {
	getOrganization,
	removeOrganization,
	setOrganization,
} from "../../../util/organization";
import { useNavigate } from "../../../util/url";
import { type InitValid, init_valid, validJwt } from "../../../util/valid";
import { PLAN_PARAM } from "../../auth/auth";

export interface Props {
	apiUrl: string;
}

const ConsoleRedirect = (props: Props) => {
	const [bencher_valid] = createResource(init_valid);
	const user = authUser();
	const navigate = useNavigate();

	const logout = () => {
		removeUser();
		removeOrganization();
		navigate("/auth/login", { replace: true });
	};
	const help = () => {
		navigateNotify(
			NotifyKind.ERROR,
			"Failed to load Bencher Console. This may be a bug. Please try again or contact support.",
			`/console/users/${user?.user?.slug}/help`,
			[PLAN_PARAM],
			[],
			true,
		);
	};

	const orgsFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			token: user.token,
		};
	});
	const getOrganizations = async (fetcher: {
		bencher_valid: InitValid;
		token: string;
	}) => {
		const cachedOrganization = getOrganization();
		if (cachedOrganization) {
			navigate(
				forwardParams(
					`/console/organizations/${cachedOrganization?.slug}/projects`,
					[NOTIFY_KIND_PARAM, NOTIFY_TEXT_PARAM],
					null,
				),
				{ replace: true },
			);
		}
		if (!fetcher.bencher_valid) {
			return;
		}
		if (!validJwt(fetcher.token)) {
			logout();
			return;
		}
		const path = "/v0/organizations?per_page=2";
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				const orgs = resp?.data;
				switch (orgs?.length) {
					case 0:
						help();
						break;
					case 1:
						break;
					default:
						navigate("/console/organizations", { replace: true });
						break;
				}
				return orgs;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				help();
				return;
			});
	};
	const [organizations] = createResource<undefined | JsonOrganization[]>(
		orgsFetcher,
		getOrganizations,
	);

	const organization = createMemo(() => {
		const orgs = organizations();
		if (Array.isArray(orgs) && (orgs?.length ?? 0) > 0) {
			const org = orgs?.[0] as JsonOrganization;
			if (orgs.length === 1) {
				setOrganization(org);
			}
			return org;
		}
		return undefined;
	});

	const projectsFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			token: user.token,
			organization: organization(),
		};
	});
	const getProjects = async (fetcher: {
		bencher_valid: InitValid;
		token: string;
		organization: undefined | JsonOrganization;
	}) => {
		if (!fetcher.bencher_valid) {
			return;
		}
		if (!validJwt(fetcher.token)) {
			logout();
			return;
		}
		if (
			organizations.loading ||
			(organizations()?.length ?? 0) > 1 ||
			fetcher.organization === undefined
		) {
			return;
		}
		const path = `/v0/organizations/${fetcher.organization?.slug}/projects?per_page=1`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				const projects = resp?.data;
				switch (projects?.length) {
					case 0:
						navigate(
							forwardParams("/console/onboard/token", [PLAN_PARAM], []),
							{ replace: true },
						);
						break;
					default:
						navigate(
							forwardParams(
								`/console/organizations/${fetcher.organization?.slug}/projects`,
								[NOTIFY_KIND_PARAM, NOTIFY_TEXT_PARAM],
								null,
							),
							{ replace: true },
						);
				}
				return projects;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				help();
				return;
			});
	};
	const [_projects] = createResource<undefined | JsonProject[]>(
		projectsFetcher,
		getProjects,
	);

	return <></>;
};

export default ConsoleRedirect;
