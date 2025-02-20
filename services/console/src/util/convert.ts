import { ModelTest, PlanLevel } from "../types/bencher";

export const dateTimeMillis = (date_str: undefined | string) => {
	if (date_str === undefined) {
		return null;
	}
	const date_ms = Date.parse(date_str);
	if (date_ms) {
		const date = new Date(date_ms);
		if (date) {
			return date.getTime();
		}
	}
	return null;
};

export const fmtDate = (date_str: undefined | string) => {
	if (date_str === undefined) {
		return null;
	}
	const date_ms = Date.parse(date_str);
	if (date_ms) {
		const date = new Date(date_ms);
		if (date) {
			return date.toDateString();
		}
	}
	return null;
};

export const addToArray = (
	array: string[],
	add: string,
): [string[], null | number] => {
	if (array.includes(add)) {
		return [array, null];
	}
	const len = array.push(add);
	return [array, len - 1];
};
export const removeFromArray = (
	array: string[],
	remove: string,
): [string[], null | number] => {
	const index = array.indexOf(remove);
	if (index < 0) {
		return [array, null];
	}
	array.splice(index, 1);
	return [array, index];
};

export const arrayFromString = (array_str: undefined | string): string[] => {
	if (typeof array_str === "string") {
		if (array_str === "") {
			return [];
		}
		return array_str.split(",");
	}
	return [];
};
export const arrayToString = (array: string[]) => array.join();

export const sizeArray = (
	parent: string[],
	child: (string | null)[],
): (string | null)[] => parent.map((_, i) => child[i] ?? "");

export const timeToDate = (time_str: undefined | string): null | Date => {
	if (typeof time_str === "string") {
		const time = Number.parseInt(time_str);
		if (Number.isInteger(time)) {
			const date = new Date(time);
			if (date) {
				return date;
			}
		}
	}
	return null;
};

export const timeToDateIso = (time_str: undefined | string): null | string => {
	const date = timeToDate(time_str);
	if (date) {
		return date.toISOString();
	}
	return null;
};

export const timeToDateOnlyIso = (
	time_str: undefined | string,
): undefined | string => {
	const iso_date = timeToDateIso(time_str);
	if (iso_date) {
		return iso_date.split("T")?.[0];
	}
	return;
};

export const dateToTime = (date_str: undefined | string): null | string => {
	if (typeof date_str === "string") {
		const time = Date.parse(date_str);
		if (time) {
			return `${time}`;
		}
	}
	return null;
};

export const isBoolParam = (param: undefined | string): boolean => {
	return param === "false" || param === "true";
};

export const planLevel = (level: undefined | PlanLevel) => {
	switch (level) {
		case PlanLevel.Free:
			return "Free";
		case PlanLevel.Team:
			return "Team";
		case PlanLevel.Enterprise:
			return "Enterprise";
		default:
			return "Bencher Plus";
	}
};

export const planLevelPrice = (level: undefined | PlanLevel) => {
	switch (level) {
		case PlanLevel.Free:
			return 0.0;
		case PlanLevel.Team:
			return 0.01;
		case PlanLevel.Enterprise:
			return 0.05;
		default:
			return 0.0;
	}
};

export const suggestedMetrics = (usage: undefined | number) =>
	(Math.round((usage ?? 1) / 1_000) + 1) * 12_000;

export const fmtUsd = (usd: undefined | number) => {
	const numberFmd = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	});
	return numberFmd.format(usd ?? 0);
};

// https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
export const base64ToBytes = (base64) => {
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.codePointAt(0));
};

export const decodeBase64 = (base64) =>
	new TextDecoder().decode(base64ToBytes(base64));

export const bytesToBase64 = (bytes) => {
	const binString = String.fromCodePoint(...bytes);
	return btoa(binString);
};

export const encodeBase64 = (str) =>
	bytesToBase64(new TextEncoder().encode(str));

export const prettyPrintFloat = (float: number | undefined) => {
	return float?.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
};
