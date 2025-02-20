import * as Sentry from "@sentry/astro";
import { new_slug } from "bencher_valid";
import { createEffect, createMemo, createResource } from "solid-js";
import type {
	JsonOrganization,
	JsonProject,
	JsonToken,
	PlanLevel,
} from "../../../types/bencher";
import { authUser } from "../../../util/auth";
import { httpGet } from "../../../util/http";
import { getOrganization, setOrganization } from "../../../util/organization";
import { useSearchParams } from "../../../util/url";
import {
	type InitValid,
	init_valid,
	validJwt,
	validPlanLevel,
} from "../../../util/valid";
import { PLAN_PARAM, planParam } from "../../auth/auth";
import CopyButton from "./CopyButton";
import OnboardSteps from "./OnboardSteps";
import { OnboardStep } from "./OnboardStepsInner";

export interface Props {
	apiUrl: string;
	isBencherCloud: boolean;
}

const OnboardRun = (props: Props) => {
	const [bencher_valid] = createResource(init_valid);
	const user = authUser();
	const [searchParams, setSearchParams] = useSearchParams();

	const plan = createMemo(() => searchParams[PLAN_PARAM] as PlanLevel);

	createEffect(() => {
		if (!bencher_valid()) {
			return;
		}

		const initParams: Record<string, null | string> = {};
		if (!validPlanLevel(searchParams[PLAN_PARAM])) {
			initParams[PLAN_PARAM] = null;
		}
		if (Object.keys(initParams).length !== 0) {
			setSearchParams(initParams);
		}
	});

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
			return [cachedOrganization];
		}
		if (!fetcher.bencher_valid) {
			return undefined;
		}
		if (!validJwt(fetcher.token)) {
			return null;
		}
		const path = "/v0/organizations";
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				return resp?.data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return null;
			});
	};
	const [organizations] = createResource<null | JsonOrganization[]>(
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
			return undefined;
		}
		if (!validJwt(fetcher.token)) {
			return null;
		}
		if (organizations.loading) {
			return undefined;
		}
		if (fetcher.organization === undefined) {
			return undefined;
		}
		if (fetcher.organization === null) {
			return null;
		}
		const path = `/v0/organizations/${fetcher.organization?.slug}/projects`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				return resp?.data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return null;
			});
	};
	const [projects] = createResource<null | JsonProject[]>(
		projectsFetcher,
		getProjects,
	);

	const tokenName = createMemo(() => `${user?.user?.name}'s token`);

	const tokensFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			token: user.token,
		};
	});
	const getTokens = async (fetcher: {
		bencher_valid: InitValid;
		token: string;
	}) => {
		if (!fetcher.bencher_valid) {
			return undefined;
		}
		if (!validJwt(fetcher.token)) {
			return null;
		}
		const path = `/v0/users/${
			user?.user?.uuid
		}/tokens?name=${encodeURIComponent(tokenName())}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				return resp?.data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return null;
			});
	};
	const [apiTokens] = createResource<null | JsonToken[]>(
		tokensFetcher,
		getTokens,
	);

	const runCode = createMemo(() => {
		const orgProjects = projects();
		const project =
			Array.isArray(orgProjects) && (orgProjects?.length ?? 0) > 0
				? (orgProjects?.[0] as JsonProject)
				: {
						slug: bencher_valid()
							? new_slug(`${user?.user?.name}'s project`)
							: "",
					};
		const token =
			Array.isArray(apiTokens()) && (apiTokens()?.length ?? 0) > 0
				? (apiTokens()?.[0] as JsonToken)
				: {
						token: "YOUR_TOKEN_HERE",
					};
		const host = props.isBencherCloud ? "" : `--host ${props.apiUrl} `;
		return `bencher run --project ${project.slug} --token ${token.token} ${host}bencher mock`;
	});

	return (
		<>
			<OnboardSteps step={OnboardStep.RUN} plan={plan} />

			<section class="section">
				<div class="container">
					<div class="columns is-centered">
						<div class="column is-half">
							<div class="content has-text-centered">
								<h1 class="title is-1">Track your benchmarks</h1>
								<h2 class="subtitle is-4">
									Install the Bencher CLI and run your first benchmarks.
								</h2>
								<figure class="frame">
									<pre data-language="plaintext">
										<code>
											<div class="code">{runCode()}</div>
										</code>
									</pre>
									<CopyButton text={runCode()} />
								</figure>
								<br />
								<br />
								<a
									class="button is-primary is-fullwidth"
									href={`/console/onboard/invite${planParam(plan())}`}
								>
									<span class="icon-text">
										<span>Next Step</span>
										<span class="icon">
											<i class="fas fa-chevron-right" />
										</span>
									</span>
								</a>
							</div>
						</div>
					</div>
				</div>
			</section>
		</>
	);
};

export default OnboardRun;
