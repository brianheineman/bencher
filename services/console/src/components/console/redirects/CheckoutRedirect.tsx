import * as Sentry from "@sentry/astro";
import { createEffect, createResource } from "solid-js";
import type { JsonNewPlan } from "../../../types/bencher";
import { authUser } from "../../../util/auth";
import { httpPost } from "../../../util/http";
import { NotifyKind, navigateNotify } from "../../../util/notify";
import { useSearchParams } from "../../../util/url";
import {
	init_valid,
	validJwt,
	validOptionUuid,
	validPlanLevel,
	validU32,
} from "../../../util/valid";
import { PLAN_PARAM } from "../../auth/auth";

export interface Props {
	apiUrl: string;
	organization: undefined | string;
}

const CheckoutRedirect = (props: Props) => {
	const [bencher_valid] = createResource(init_valid);
	const user = authUser();
	const [searchParams, _setSearchParams] = useSearchParams();

	createEffect(() => {
		if (!bencher_valid()) {
			return;
		}
		const token = user?.token;
		if (!validJwt(token)) {
			return;
		}

		const checkout = searchParams.checkout;
		const level = searchParams.level;
		const entitlementsString = searchParams.entitlements;
		const entitlements = Number.parseInt(entitlementsString);
		const self_hosted = searchParams.self_hosted;
		const billing = `/console/organizations/${props.organization}/billing`;
		if (
			!checkout ||
			!validPlanLevel(level) ||
			(entitlementsString && !validU32(entitlements)) ||
			(self_hosted && !validOptionUuid(self_hosted))
		) {
			return;
		}

		const newPlan: JsonNewPlan = {
			checkout,
			level,
			entitlements,
			self_hosted,
		};

		httpPost(
			props.apiUrl,
			`/v0/organizations/${props.organization}/plan`,
			token,
			newPlan,
		)
			.then((_resp) => {
				navigateNotify(
					NotifyKind.OK,
					"Somebunny loves us! Successful plan enrollment.",
					billing,
					null,
					null,
					true,
				);
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				navigateNotify(
					NotifyKind.ERROR,
					"Lettuce romaine calm! Failed to enroll. Please, try again.",
					billing,
					null,
					[[PLAN_PARAM, level]],
					true,
				);
			});
	});

	return <></>;
};

export default CheckoutRedirect;
