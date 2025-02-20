import * as Sentry from "@sentry/astro";
import { createEffect, createMemo, createResource } from "solid-js";
import type {
	JsonNewToken,
	JsonToken,
	PlanLevel,
} from "../../../types/bencher";
import { authUser } from "../../../util/auth";
import { httpGet, httpPost } from "../../../util/http";
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
}

const OnboardToken = (props: Props) => {
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
			return;
		}
		if (!validJwt(fetcher.token)) {
			return;
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
				return;
			});
	};
	const [apiTokens] = createResource<undefined | JsonToken[]>(
		tokensFetcher,
		getTokens,
	);

	const tokenFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			token: user.token,
			tokens: apiTokens(),
		};
	});
	const getToken = async (fetcher: {
		bencher_valid: InitValid;
		token: string;
		tokens: undefined | JsonToken[];
	}) => {
		if (!fetcher.bencher_valid) {
			return;
		}
		if (!validJwt(fetcher.token) || fetcher.tokens === undefined) {
			return;
		}
		// There should only ever be one token
		if (fetcher.tokens.length > 0) {
			return fetcher.tokens[0];
		}
		const path = `/v0/users/${user?.user?.uuid}/tokens`;
		const data: JsonNewToken = {
			name: tokenName(),
		};
		return await httpPost(props.apiUrl, path, fetcher.token, data)
			.then((resp) => {
				return resp?.data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return;
			});
	};
	const [apiToken] = createResource<undefined | JsonToken>(
		tokenFetcher,
		getToken,
	);

	return (
		<>
			<OnboardSteps step={OnboardStep.API_TOKEN} plan={plan} />

			<section class="section">
				<div class="container">
					<div class="columns is-centered">
						<div class="column is-half">
							<div class="content has-text-centered">
								<h1 class="title is-1">Use this API token</h1>
								<h2 class="subtitle is-4">
									Authenticate with Bencher using this API token.
								</h2>
								<figure class="frame">
									<pre data-language="plaintext">
										<code>
											<div class="code">{apiToken()?.token}</div>
										</code>
									</pre>
									<CopyButton text={apiToken()?.token ?? ""} />
								</figure>
								<br />
								<br />
								<a
									class="button is-primary is-fullwidth"
									href={`/console/onboard/project${planParam(plan())}`}
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

export default OnboardToken;
