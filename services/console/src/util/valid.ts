import * as Sentry from "@sentry/astro";
import bencher_valid_init, {
	type InitOutput,
	is_valid_benchmark_name,
	is_valid_boundary,
	is_valid_branch_name,
	is_valid_card_cvc,
	is_valid_card_number,
	is_valid_email,
	is_valid_expiration_month,
	is_valid_expiration_year,
	is_valid_index,
	is_valid_jwt,
	is_valid_non_empty,
	is_valid_resource_name,
	is_valid_plan_level,
	is_valid_sample_size,
	is_valid_slug,
	is_valid_url,
	is_valid_user_name,
	is_valid_uuid,
	is_valid_percentage_boundary,
	is_valid_cdf_boundary,
	is_valid_iqr_boundary,
	is_valid_model,
	is_valid_window,
} from "bencher_valid";
import type { JsonAuthUser } from "../types/bencher";

export const DEBOUNCE_DELAY = 10;

export type InitValid = undefined | InitOutput;

export const init_valid = async (): Promise<InitValid> => {
	try {
		return await bencher_valid_init();
	} catch (error) {
		console.error(error);
		Sentry.captureException(error);
		return;
	}
};

export const validString = (
	input: string,
	validator: (input: string) => boolean,
): boolean => validator(input.trim());

export const validOptionString = (
	input: undefined | null | string,
	validator: (input: string) => boolean,
): boolean => {
	if (typeof input !== "string" || input.length === 0) {
		return false;
	}
	return validString(input, validator);
};

export const validUuid = (uuid: string): boolean =>
	validString(uuid, is_valid_uuid);

export const validOptionUuid = (uuid: undefined | null | string): boolean =>
	validOptionString(uuid, is_valid_uuid);

export const validUserName = (user_name: string): boolean =>
	validString(user_name, is_valid_user_name);

export const validResourceName = (resource_name: string): boolean =>
	validString(resource_name, is_valid_resource_name);

export const validOptionResourceName = (
	resource_name: undefined | null | string,
): boolean => validOptionString(resource_name, is_valid_resource_name);

export const validBranchName = (branch_name: string): boolean =>
	validString(branch_name, is_valid_branch_name);

export const validBenchmarkName = (benchmark_name: string): boolean =>
	validString(benchmark_name, is_valid_benchmark_name);

export const validNonEmpty = (non_empty: string): boolean =>
	validString(non_empty, is_valid_non_empty);

export const validSlug = (slug: undefined | null | string): boolean =>
	validOptionString(slug, is_valid_slug);

export const validEmail = (email: undefined | null | string): boolean =>
	validOptionString(email, is_valid_email);

export const validJwt = (token: undefined | null | string): boolean =>
	validOptionString(token, is_valid_jwt);

export const validOptionJwt = (token: undefined | null | string): boolean =>
	validOptionString(token, (i) => i.length === 0 || is_valid_jwt(i));

export const validOptionUrl = (url: undefined | null | string): boolean =>
	validOptionString(url, (i) => i.length === 0 || is_valid_url(i));

export const validUser = (user: JsonAuthUser): boolean =>
	validUuid(user.user.uuid) &&
	validUserName(user.user.name) &&
	validSlug(user.user.slug) &&
	validEmail(user.user.email) &&
	validJwt(user.token);

export const validateNumber = (
	input: string,
	validator: (input: number) => boolean,
): boolean => {
	if (input.length === 0) {
		return false;
	}
	if (typeof input === "string") {
		const num = Number(input.trim());
		return validator(num);
	}
	return false;
};

export const validU32 = (input: undefined | number | string) => {
	if (input === undefined || input === null) {
		return false;
	}
	if (typeof input === "string" && input.length === 0) {
		return false;
	}
	const num = Number(input);
	return Number.isInteger(num) && num >= 0 && num <= 4_294_967_295;
};

const validNumberStr = (
	numberStr: undefined | number | string,
	validator: (input: number) => boolean,
) =>
	validU32(numberStr) && validateNumber(numberStr?.toString() ?? "", validator);

export const validWindow = (window: undefined | number | string): boolean =>
	validNumberStr(window, is_valid_window);

export const validIndex = (index: undefined | number | string): boolean =>
	validNumberStr(index, is_valid_index);

export const validBoundary = (boundary: string): boolean =>
	validateNumber(boundary, is_valid_boundary);

export const validPercentageBoundary = (boundary: string): boolean =>
	validateNumber(boundary, is_valid_percentage_boundary);

export const validCdfBoundary = (boundary: string): boolean =>
	validateNumber(boundary, is_valid_cdf_boundary);

export const validIqrBoundary = (boundary: string): boolean =>
	validateNumber(boundary, is_valid_iqr_boundary);

export const validSampleSize = (sample_size: string) =>
	validU32(sample_size) && validateNumber(sample_size, is_valid_sample_size);

export const validModel = (model: object) => {
	if (!model || typeof model !== "object") {
		return false;
	}
	return is_valid_model(JSON.stringify(model));
};

// Billing
export const validPlanLevel = (planLevel: undefined | null | string): boolean =>
	validOptionString(planLevel, is_valid_plan_level);

export const validCardNumber = (card_number: string): boolean => {
	return validString(card_number, (card_number) => {
		const number = cleanCardNumber(card_number);
		return is_valid_card_number(number);
	});
};

export const cleanCardNumber = (card_number: string): string => {
	return card_number.replace(/ /g, "").replace(/-/g, "");
};

export const validExpiration = (expiration: string): boolean => {
	return validString(expiration, (expiration) => {
		if (!/^\d{1,2}\/\d{2,4}$/.test(expiration)) {
			return false;
		}

		if (cleanExpiration(expiration) === null) {
			return false;
		}
		return true;
	});
};

export const cleanExpiration = (expiration: string): null | number[] => {
	const exp = expiration.split("/");
	if (exp.length !== 2) {
		return null;
	}

	const month = exp?.[0];
	if (month === undefined) {
		return null;
	}
	const exp_month = Number.parseInt(month);
	if (Number.isInteger(exp_month)) {
		if (!is_valid_expiration_month(exp_month)) {
			return null;
		}
	} else {
		return null;
	}

	const year = exp?.[1];
	if (year === undefined) {
		return null;
	}
	let exp_year = Number.parseInt(year);
	if (Number.isInteger(exp_year)) {
		if (exp_year < 100) {
			exp_year = 2000 + exp_year;
		}
		if (!is_valid_expiration_year(exp_year)) {
			return null;
		}
	} else {
		return null;
	}

	return [exp_month, exp_year];
};

export const validCardCvc = (card_cvc: string): boolean => {
	return validString(card_cvc, is_valid_card_cvc);
};
