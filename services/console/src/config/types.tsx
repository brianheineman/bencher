import { XAxis } from "../types/bencher";

export enum BencherResource {
	ORGANIZATIONS = "organizations",
	MEMBERS = "members",
	BILLING = "billing",
	PROJECTS = "projects",
	REPORTS = "reports",
	BRANCHES = "branches",
	TESTBEDS = "testbeds",
	BENCHMARKS = "benchmarks",
	MEASURES = "measures",
	METRICS = "metrics",
	THRESHOLDS = "thresholds",
	ALERTS = "alerts",
	USERS = "users",
	TOKENS = "tokens",
	HELP = "help",
}

export const resourceSingular = (resource: BencherResource) => {
	switch (resource) {
		case BencherResource.ORGANIZATIONS:
			return "organization";
		case BencherResource.MEMBERS:
			return "member";
		case BencherResource.BILLING:
			return "billing";
		case BencherResource.PROJECTS:
			return "project";
		case BencherResource.REPORTS:
			return "report";
		case BencherResource.BRANCHES:
			return "branch";
		case BencherResource.TESTBEDS:
			return "testbed";
		case BencherResource.BENCHMARKS:
			return "benchmark";
		case BencherResource.MEASURES:
			return "measure";
		case BencherResource.METRICS:
			return "metric";
		case BencherResource.THRESHOLDS:
			return "threshold";
		case BencherResource.ALERTS:
			return "alert";
		case BencherResource.USERS:
			return "user";
		case BencherResource.TOKENS:
			return "token";
		case BencherResource.HELP:
			return "help";
	}
};

export const resourcePlural = (resource: BencherResource) => {
	switch (resource) {
		case BencherResource.ORGANIZATIONS:
			return "organizations";
		case BencherResource.MEMBERS:
			return "members";
		case BencherResource.BILLING:
			return "billing";
		case BencherResource.PROJECTS:
			return "projects";
		case BencherResource.REPORTS:
			return "reports";
		case BencherResource.BRANCHES:
			return "branches";
		case BencherResource.TESTBEDS:
			return "testbeds";
		case BencherResource.BENCHMARKS:
			return "benchmarks";
		case BencherResource.MEASURES:
			return "measures";
		case BencherResource.METRICS:
			return "metrics";
		case BencherResource.THRESHOLDS:
			return "thresholds";
		case BencherResource.ALERTS:
			return "alerts";
		case BencherResource.USERS:
			return "users";
		case BencherResource.TOKENS:
			return "tokens";
		case BencherResource.HELP:
			return "help";
	}
};

export enum Operation {
	LIST = "list",
	ADD = "add",
	VIEW = "view",
	EDIT = "edit",
	DELETE = "delete",
}

export enum Button {
	ADD = "add",
	INVITE = "invite",
	EDIT = "edit",
	STATUS = "status",
	CONSOLE = "console",
	PERF = "perf",
	REFRESH = "refresh",
	BACK = "back",
	SEARCH = "search",
	DATE_TIME = "date_time",
	ARCHIVED = "archived",
	DISMISS_ALL = "dismiss_all",
}

export enum ActionButton {
	ARCHIVE = "archive",
	ARCHIVED = "archived",
	HEAD_REPLACED = "head_replaced",
	REMOVE_MODEL = "remove_model",
	MODEL_REPLACED = "model_replaced",
	RAW = "raw",
	DELETE = "delete",
}

export enum Row {
	TEXT = "text",
	DATE_TIME = "date_time",
	BOOL = "bool",
	SELECT = "select",
	NESTED_TEXT = "nested_text",
	REPORT = "report",
	THRESHOLD = "threshold",
	ALERT = "alert",
}

export enum Card {
	FIELD = "field",
	NESTED_FIELD = "nested_field",
	REPORT = "report",
	REPORT_TABLE = "report_table",
	THRESHOLD_TABLE = "threshold_table",
}

export enum Display {
	RAW = "raw",
	FLOAT = "float",
	DATE_TIME = "date_time",
	REPORT = "report",
	BRANCH = "branch",
	TESTBED = "testbed",
	BENCHMARK = "benchmark",
	MEASURE = "measure",
	SWITCH = "switch",
	SELECT = "select",
	PLOT_URL = "plot_url",
	START_POINT = "start_point",
	GIT_HASH = "git_hash",
	ADAPTER = "adapter",
	THRESHOLD = "threshold",
	MODEL_TEST = "model_test",
}

export enum ReportDimension {
	BRANCH = "branch",
	TESTBED = "testbed",
}

export enum ThresholdDimension {
	BRANCH = "branch",
	TESTBED = "testbed",
	MEASURE = "measure",
}

export enum PerfTab {
	REPORTS = "reports",
	BRANCHES = "branches",
	TESTBEDS = "testbeds",
	BENCHMARKS = "benchmarks",
	PLOTS = "plots",
}

export const isPerfTab = (tab: undefined | string) =>
	tab === PerfTab.REPORTS ||
	tab === PerfTab.BRANCHES ||
	tab === PerfTab.TESTBEDS ||
	tab === PerfTab.BENCHMARKS ||
	tab === PerfTab.PLOTS;

export const isXAxis = (xAxis: undefined | string) => {
	switch (xAxis) {
		case XAxis.DateTime:
		case XAxis.Version:
			return true;
		default:
			return false;
	}
};

export const embedHeight = 780;
