import * as Sentry from "@sentry/astro";
import { debounce } from "@solid-primitives/scheduled";
import type { Params } from "astro";
import {
	Show,
	createEffect,
	createMemo,
	createResource,
	createSignal,
} from "solid-js";
import { createStore } from "solid-js/store";
import { PerfTab, isPerfTab, isXAxis } from "../../../config/types";
import {
	type JsonBenchmark,
	type JsonBranch,
	type JsonPerfQuery,
	type JsonPlot,
	type JsonProject,
	type JsonReport,
	type JsonTestbed,
	PerfQueryKey,
	PlotKey,
	XAxis,
} from "../../../types/bencher";
import { authUser } from "../../../util/auth";
import {
	addToArray,
	arrayFromString,
	arrayToString,
	dateTimeMillis,
	dateToTime,
	isBoolParam,
	removeFromArray,
	sizeArray,
	timeToDate,
	timeToDateOnlyIso,
} from "../../../util/convert";
import { X_TOTAL_COUNT, httpGet } from "../../../util/http";
import { useSearchParams } from "../../../util/url";
import {
	DEBOUNCE_DELAY,
	type InitValid,
	init_valid,
	validJwt,
	validU32,
} from "../../../util/valid";
import { themeSignal } from "../../navbar/theme/util";
import PerfFrame from "./PerfFrame";
import PerfHeader from "./header/PerfHeader";
import type { TabList } from "./plot/tab/PlotTab";
import PlotTab from "./plot/tab/PlotTab";

// Perf query params
const BRANCHES_PARAM = PerfQueryKey.Branches;
const HEADS_PARAM = PerfQueryKey.Heads;
const TESTBEDS_PARAM = PerfQueryKey.Testbeds;
const BENCHMARKS_PARAM = PerfQueryKey.Benchmarks;
const MEASURES_PARAM = PerfQueryKey.Measures;
const START_TIME_PARAM = PerfQueryKey.StartTime;
const END_TIME_PARAM = PerfQueryKey.EndTime;

// Console UI state query params
const REPORT_PARAM = "report";
const PLOT_PARAM = "plot";

const REPORTS_PER_PAGE_PARAM = "reports_per_page";
const BRANCHES_PER_PAGE_PARAM = "branches_per_page";
const TESTBEDS_PER_PAGE_PARAM = "testbeds_per_page";
const BENCHMARKS_PER_PAGE_PARAM = "benchmarks_per_page";
const PLOTS_PER_PAGE_PARAM = "plots_per_page";

const REPORTS_PAGE_PARAM = "reports_page";
const BRANCHES_PAGE_PARAM = "branches_page";
const TESTBEDS_PAGE_PARAM = "testbeds_page";
const BENCHMARKS_PAGE_PARAM = "benchmarks_page";
const PLOTS_PAGE_PARAM = "plots_page";

const REPORTS_START_TIME_PARAM = "reports_start_time";
const REPORTS_END_TIME_PARAM = "reports_end_time";
const BRANCHES_SEARCH_PARAM = "branches_search";
const TESTBEDS_SEARCH_PARAM = "testbeds_search";
const BENCHMARKS_SEARCH_PARAM = "benchmarks_search";
const PLOTS_SEARCH_PARAM = "plots_search";

const TAB_PARAM = "tab";
const KEY_PARAM = "key";
const LOWER_VALUE_PARAM = PlotKey.LowerValue;
const UPPER_VALUE_PARAM = PlotKey.UpperValue;
const LOWER_BOUNDARY_PARAM = PlotKey.LowerBoundary;
const UPPER_BOUNDARY_PARAM = PlotKey.UpperBoundary;
const X_AXIS_PARAM = PlotKey.XAxis;
// TODO remove in due time
const RANGE_PARAM = "range";
const CLEAR_PARAM = "clear";

// These are currently for internal use only
// TODO add a way to set these in the Share modal
// The title can be set but there is no way to set an empty title
const EMBED_LOGO_PARAM = "embed_logo";
export const EMBED_TITLE_PARAM = "embed_title";
const EMBED_HEADER_PARAM = "embed_header";
const EMBED_KEY_PARAM = "embed_key";

// This is used to trim down the number of query params when embedding, etc.
export const PERF_QUERY_PARAMS = [
	BRANCHES_PARAM,
	HEADS_PARAM,
	TESTBEDS_PARAM,
	BENCHMARKS_PARAM,
	MEASURES_PARAM,
	START_TIME_PARAM,
	END_TIME_PARAM,
];
export const PERF_PLOT_PARAMS = [
	...PERF_QUERY_PARAMS,
	REPORT_PARAM,
	REPORTS_PER_PAGE_PARAM,
	BRANCHES_PER_PAGE_PARAM,
	TESTBEDS_PER_PAGE_PARAM,
	BENCHMARKS_PER_PAGE_PARAM,
	PLOTS_PER_PAGE_PARAM,
	REPORTS_PAGE_PARAM,
	BRANCHES_PAGE_PARAM,
	TESTBEDS_PAGE_PARAM,
	BENCHMARKS_PAGE_PARAM,
	PLOTS_PAGE_PARAM,
	REPORTS_START_TIME_PARAM,
	REPORTS_END_TIME_PARAM,
	BRANCHES_SEARCH_PARAM,
	TESTBEDS_SEARCH_PARAM,
	BENCHMARKS_SEARCH_PARAM,
	PLOTS_SEARCH_PARAM,
	TAB_PARAM,
	KEY_PARAM,
	X_AXIS_PARAM,
	CLEAR_PARAM,
	LOWER_VALUE_PARAM,
	UPPER_VALUE_PARAM,
	LOWER_BOUNDARY_PARAM,
	UPPER_BOUNDARY_PARAM,
];
export const PERF_PLOT_EMBED_PARAMS = [
	...PERF_PLOT_PARAMS,
	EMBED_LOGO_PARAM,
	EMBED_TITLE_PARAM,
	EMBED_HEADER_PARAM,
	EMBED_KEY_PARAM,
];
export const PERF_PLOT_PIN_PARAMS = [
	BRANCHES_PARAM,
	TESTBEDS_PARAM,
	BENCHMARKS_PARAM,
	MEASURES_PARAM,
	LOWER_VALUE_PARAM,
	UPPER_VALUE_PARAM,
	LOWER_BOUNDARY_PARAM,
	UPPER_BOUNDARY_PARAM,
];

const DEFAULT_PERF_TAB = PerfTab.REPORTS;
const DEFAULT_PERF_KEY = true;
const DEFAULT_X_AXIS = XAxis.DateTime;
const DEFAULT_PERF_CLEAR = false;
const DEFAULT_PERF_END_VALUE = false;
const DEFAULT_PERF_BOUNDARY = false;

const DEFAULT_EMBED_LOGO = true;
const DEFAULT_EMBED_HEADER = true;
const DEFAULT_EMBED_KEY = true;

export const DEFAULT_PER_PAGE = 8;
export const REPORTS_PER_PAGE = 4;
export const DEFAULT_PAGE = 1;

// 30 days
const DEFAULT_REPORT_HISTORY = 30 * 24 * 60 * 60 * 1000;

export interface Props {
	apiUrl: string;
	isBencherCloud: boolean;
	params: Params;
	isConsole?: boolean;
	isEmbed?: boolean;
	project?: undefined | JsonProject;
}

function resourcesToCheckable<T>(
	resources: { uuid: string }[],
	params: (undefined | string)[],
): TabList<T> {
	return resources.map((resource) => {
		return {
			resource: resource as T,
			checked: params.includes(resource?.uuid),
		};
	});
}

const PerfPanel = (props: Props) => {
	const [bencher_valid] = createResource(init_valid);

	const params = createMemo(() => props.params);
	const [searchParams, setSearchParams] = useSearchParams();
	const user = authUser();
	const theme = themeSignal;

	const [init, setInit] = createSignal(false);
	// Sanitize all query params
	createEffect(() => {
		if (init()) {
			return;
		}
		const initParams: Record<
			string,
			undefined | null | boolean | number | string
		> = {};

		if (typeof searchParams[REPORT_PARAM] !== "string") {
			initParams[REPORT_PARAM] = null;
		}
		if (!Array.isArray(arrayFromString(searchParams[BRANCHES_PARAM]))) {
			initParams[BRANCHES_PARAM] = null;
		}
		if (!Array.isArray(arrayFromString(searchParams[HEADS_PARAM]))) {
			initParams[HEADS_PARAM] = null;
		}
		if (!Array.isArray(arrayFromString(searchParams[TESTBEDS_PARAM]))) {
			initParams[TESTBEDS_PARAM] = null;
		}
		if (!Array.isArray(arrayFromString(searchParams[BENCHMARKS_PARAM]))) {
			initParams[BENCHMARKS_PARAM] = null;
		}
		if (!Array.isArray(arrayFromString(searchParams[MEASURES_PARAM]))) {
			initParams[MEASURES_PARAM] = null;
		}
		if (!timeToDate(searchParams[START_TIME_PARAM])) {
			initParams[START_TIME_PARAM] = null;
		}
		if (!timeToDate(searchParams[END_TIME_PARAM])) {
			initParams[END_TIME_PARAM] = null;
		}

		// Sanitize all UI state query params
		if (!isPerfTab(searchParams[TAB_PARAM])) {
			initParams[TAB_PARAM] = null;
		}
		if (!isBoolParam(searchParams[KEY_PARAM])) {
			initParams[KEY_PARAM] = DEFAULT_PERF_KEY;
		}
		if (isXAxis(searchParams[X_AXIS_PARAM])) {
			// TODO remove in due time
			initParams[RANGE_PARAM] = null;
		} else {
			initParams[X_AXIS_PARAM] = null;
		}
		// TODO remove in due time
		if (isXAxis(searchParams[RANGE_PARAM])) {
			if (!initParams[X_AXIS_PARAM]) {
				initParams[X_AXIS_PARAM] = searchParams[RANGE_PARAM];
			}
		} else {
			initParams[RANGE_PARAM] = null;
		}
		if (!isBoolParam(searchParams[CLEAR_PARAM])) {
			initParams[CLEAR_PARAM] = null;
		}
		if (!isBoolParam(searchParams[LOWER_VALUE_PARAM])) {
			initParams[LOWER_VALUE_PARAM] = null;
		}
		if (!isBoolParam(searchParams[UPPER_VALUE_PARAM])) {
			initParams[UPPER_VALUE_PARAM] = null;
		}
		if (!isBoolParam(searchParams[LOWER_BOUNDARY_PARAM])) {
			initParams[LOWER_BOUNDARY_PARAM] = null;
		}
		if (!isBoolParam(searchParams[UPPER_BOUNDARY_PARAM])) {
			initParams[UPPER_BOUNDARY_PARAM] = null;
		}

		// Sanitize all pagination query params
		if (!validU32(searchParams[REPORTS_PER_PAGE_PARAM])) {
			initParams[REPORTS_PER_PAGE_PARAM] = REPORTS_PER_PAGE;
		}
		if (!validU32(searchParams[BRANCHES_PER_PAGE_PARAM])) {
			initParams[BRANCHES_PER_PAGE_PARAM] = DEFAULT_PER_PAGE;
		}
		if (!validU32(searchParams[TESTBEDS_PER_PAGE_PARAM])) {
			initParams[TESTBEDS_PER_PAGE_PARAM] = DEFAULT_PER_PAGE;
		}
		if (!validU32(searchParams[BENCHMARKS_PER_PAGE_PARAM])) {
			initParams[BENCHMARKS_PER_PAGE_PARAM] = DEFAULT_PER_PAGE;
		}
		if (!validU32(searchParams[PLOTS_PER_PAGE_PARAM])) {
			initParams[PLOTS_PER_PAGE_PARAM] = DEFAULT_PER_PAGE;
		}

		if (!validU32(searchParams[REPORTS_PAGE_PARAM])) {
			initParams[REPORTS_PAGE_PARAM] = DEFAULT_PAGE;
		}
		if (!validU32(searchParams[BRANCHES_PAGE_PARAM])) {
			initParams[BRANCHES_PAGE_PARAM] = DEFAULT_PAGE;
		}
		if (!validU32(searchParams[TESTBEDS_PAGE_PARAM])) {
			initParams[TESTBEDS_PAGE_PARAM] = DEFAULT_PAGE;
		}
		if (!validU32(searchParams[BENCHMARKS_PAGE_PARAM])) {
			initParams[BENCHMARKS_PAGE_PARAM] = DEFAULT_PAGE;
		}
		if (!validU32(searchParams[PLOTS_PAGE_PARAM])) {
			initParams[PLOTS_PAGE_PARAM] = DEFAULT_PAGE;
		}

		if (!timeToDate(searchParams[REPORTS_START_TIME_PARAM])) {
			initParams[REPORTS_START_TIME_PARAM] = null;
		}
		if (!timeToDate(searchParams[REPORTS_END_TIME_PARAM])) {
			initParams[REPORTS_END_TIME_PARAM] = null;
		}
		if (typeof searchParams[BRANCHES_SEARCH_PARAM] !== "string") {
			initParams[BRANCHES_SEARCH_PARAM] = null;
		}
		if (typeof searchParams[TESTBEDS_SEARCH_PARAM] !== "string") {
			initParams[TESTBEDS_SEARCH_PARAM] = null;
		}
		if (typeof searchParams[BENCHMARKS_SEARCH_PARAM] !== "string") {
			initParams[BENCHMARKS_SEARCH_PARAM] = null;
		}
		if (typeof searchParams[PLOTS_SEARCH_PARAM] !== "string") {
			initParams[PLOTS_SEARCH_PARAM] = null;
		}

		// Embed params
		if (typeof searchParams[EMBED_LOGO_PARAM] !== "string") {
			initParams[EMBED_LOGO_PARAM] = null;
		}
		if (typeof searchParams[EMBED_TITLE_PARAM] !== "string") {
			initParams[EMBED_TITLE_PARAM] = null;
		}
		if (!isBoolParam(searchParams[EMBED_HEADER_PARAM])) {
			initParams[EMBED_HEADER_PARAM] = null;
		}
		if (!isBoolParam(searchParams[EMBED_KEY_PARAM])) {
			initParams[EMBED_KEY_PARAM] = null;
		}

		if (Object.keys(initParams).length === 0) {
			setInit(true);
		} else {
			setSearchParams(initParams, { replace: true });
		}
	});

	// Create marshalized memos of all query params
	const report = createMemo(() => searchParams[REPORT_PARAM]);
	const branches = createMemo(() =>
		arrayFromString(searchParams[BRANCHES_PARAM]),
	);
	const heads = createMemo(() =>
		sizeArray(branches(), arrayFromString(searchParams[HEADS_PARAM])),
	);
	const testbeds = createMemo(() =>
		arrayFromString(searchParams[TESTBEDS_PARAM]),
	);
	const benchmarks = createMemo(() =>
		arrayFromString(searchParams[BENCHMARKS_PARAM]),
	);
	const measures = createMemo(() =>
		arrayFromString(searchParams[MEASURES_PARAM]),
	);
	const plot = createMemo(() => searchParams[PLOT_PARAM]);

	// start/end_time is used for the query
	const start_time = createMemo(() => searchParams[START_TIME_PARAM]);
	const end_time = createMemo(() => searchParams[END_TIME_PARAM]);
	// start/end_date is used for the GUI selector
	const start_date = createMemo(() => timeToDateOnlyIso(start_time()));
	const end_date = createMemo(() => timeToDateOnlyIso(end_time()));

	const tab = createMemo(() => {
		// This check is required for the initial load
		// before the query params have been sanitized
		const perfTab = searchParams[TAB_PARAM];
		if (perfTab && isPerfTab(perfTab)) {
			return perfTab as PerfTab;
		}
		return DEFAULT_PERF_TAB;
	});

	// This check is required for the initial load
	// before the query params have been sanitized
	const isBoolParamOrDefault = (param: string, default_value: boolean) => {
		if (isBoolParam(searchParams[param])) {
			return searchParams[param] === "true";
		}
		return default_value;
	};

	const key = createMemo(() =>
		isBoolParamOrDefault(KEY_PARAM, DEFAULT_PERF_KEY),
	);

	const x_axis = createMemo(() => {
		// This check is required for the initial load
		// before the query params have been sanitized
		const x = searchParams[X_AXIS_PARAM];
		if (x && isXAxis(x)) {
			return x as XAxis;
		}
		// TODO remove in due time
		const r = searchParams[RANGE_PARAM];
		if (r && isXAxis(r)) {
			return r as XAxis;
		}
		return DEFAULT_X_AXIS;
	});

	// Ironically, a better name for the `clear` param would actually be `dirty`.
	// It works as a "dirty" bit to indicate that we shouldn't load the first report again.
	const clear = createMemo(() =>
		isBoolParamOrDefault(CLEAR_PARAM, DEFAULT_PERF_CLEAR),
	);

	const lower_value = createMemo(() =>
		isBoolParamOrDefault(LOWER_VALUE_PARAM, DEFAULT_PERF_END_VALUE),
	);
	const upper_value = createMemo(() =>
		isBoolParamOrDefault(UPPER_VALUE_PARAM, DEFAULT_PERF_END_VALUE),
	);

	const lower_boundary = createMemo(() =>
		isBoolParamOrDefault(LOWER_BOUNDARY_PARAM, DEFAULT_PERF_BOUNDARY),
	);
	const upper_boundary = createMemo(() =>
		isBoolParamOrDefault(UPPER_BOUNDARY_PARAM, DEFAULT_PERF_BOUNDARY),
	);

	// Pagination query params
	const reports_per_page = createMemo(() =>
		Number(searchParams[REPORTS_PER_PAGE_PARAM] ?? REPORTS_PER_PAGE),
	);
	const branches_per_page = createMemo(() =>
		Number(searchParams[BRANCHES_PER_PAGE_PARAM] ?? DEFAULT_PER_PAGE),
	);
	const testbeds_per_page = createMemo(() =>
		Number(searchParams[TESTBEDS_PER_PAGE_PARAM] ?? DEFAULT_PER_PAGE),
	);
	const benchmarks_per_page = createMemo(() =>
		Number(searchParams[BENCHMARKS_PER_PAGE_PARAM] ?? DEFAULT_PER_PAGE),
	);
	const plots_per_page = createMemo(() =>
		Number(searchParams[PLOTS_PER_PAGE_PARAM] ?? DEFAULT_PER_PAGE),
	);

	const reports_page = createMemo(() =>
		Number(searchParams[REPORTS_PAGE_PARAM] ?? DEFAULT_PAGE),
	);
	const branches_page = createMemo(() =>
		Number(searchParams[BRANCHES_PAGE_PARAM] ?? DEFAULT_PAGE),
	);
	const testbeds_page = createMemo(() =>
		Number(searchParams[TESTBEDS_PAGE_PARAM] ?? DEFAULT_PAGE),
	);
	const benchmarks_page = createMemo(() =>
		Number(searchParams[BENCHMARKS_PAGE_PARAM] ?? DEFAULT_PAGE),
	);
	const plots_page = createMemo(() =>
		Number(searchParams[PLOTS_PAGE_PARAM] ?? DEFAULT_PAGE),
	);

	const reports_start_time = createMemo(
		() => searchParams[REPORTS_START_TIME_PARAM],
	);
	const reports_start_date = createMemo(() =>
		timeToDateOnlyIso(reports_start_time()),
	);
	const reports_end_time = createMemo(
		() => searchParams[REPORTS_END_TIME_PARAM],
	);
	const reports_end_date = createMemo(() =>
		timeToDateOnlyIso(reports_end_time()),
	);

	const branches_search = createMemo(() => searchParams[BRANCHES_SEARCH_PARAM]);
	const testbeds_search = createMemo(() => searchParams[TESTBEDS_SEARCH_PARAM]);
	const benchmarks_search = createMemo(
		() => searchParams[BENCHMARKS_SEARCH_PARAM],
	);
	const plots_search = createMemo(() => searchParams[PLOTS_SEARCH_PARAM]);

	// Embed params
	const embed_logo = createMemo(() =>
		isBoolParamOrDefault(EMBED_LOGO_PARAM, DEFAULT_EMBED_LOGO),
	);
	const embed_title = createMemo(() => searchParams[EMBED_TITLE_PARAM]);
	const embed_header = createMemo(() =>
		isBoolParamOrDefault(EMBED_HEADER_PARAM, DEFAULT_EMBED_HEADER),
	);
	const embed_key = createMemo(() =>
		isBoolParamOrDefault(EMBED_KEY_PARAM, DEFAULT_EMBED_KEY),
	);

	// The perf query sent to the server
	const perfQuery = createMemo(() => {
		return {
			branches: branches(),
			heads: heads(),
			testbeds: testbeds(),
			benchmarks: benchmarks(),
			measures: measures(),
			start_time: start_time(),
			end_time: end_time(),
		} as JsonPerfQuery;
	});

	const branchesIsEmpty = createMemo(() => branches().length === 0);
	const testbedsIsEmpty = createMemo(() => testbeds().length === 0);
	const benchmarksIsEmpty = createMemo(() => benchmarks().length === 0);
	const measuresIsEmpty = createMemo(() => measures().length === 0);
	const isPlotInit = createMemo(
		() =>
			branchesIsEmpty() ||
			testbedsIsEmpty() ||
			benchmarksIsEmpty() ||
			measuresIsEmpty(),
	);

	// Refresh pref query
	const [refresh, setRefresh] = createSignal(0);
	const handleRefresh = () => {
		setRefresh(refresh() + 1);
	};

	const project_slug = createMemo(() => params().project);
	const projectFetcher = createMemo(() => {
		return {
			project_slug: project_slug(),
			refresh: refresh(),
			token: user?.token,
		};
	});
	const getProject = async (fetcher: {
		project_slug: string;
		refresh: number;
		token: string;
	}) => {
		const EMPTY_OBJECT = {};
		if (props.isConsole && typeof fetcher.token !== "string") {
			return EMPTY_OBJECT;
		}
		if (props.project) {
			return props.project;
		}
		if (!fetcher.project_slug || fetcher.project_slug === "undefined") {
			return EMPTY_OBJECT;
		}
		const path = `/v0/projects/${fetcher.project_slug}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				return resp?.data as JsonProject;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return EMPTY_OBJECT;
			});
	};
	const [project] = createResource<JsonProject>(projectFetcher, getProject);

	// Initialize as empty, wait for resources to load
	const [reports_tab, setReportsTab] = createStore<TabList<JsonReport>>([]);
	const [branches_tab, setBranchesTab] = createStore<TabList<JsonBranch>>([]);
	const [testbeds_tab, setTestbedsTab] = createStore<TabList<JsonTestbed>>([]);
	const [benchmarks_tab, setBenchmarksTab] = createStore<
		TabList<JsonBenchmark>
	>([]);
	const [plots_tab, setPlotsTab] = createStore<TabList<JsonPlot>>([]);

	const [reportsTotalCount, setReportsTotalCount] = createSignal(0);
	const [branchesTotalCount, setBranchesTotalCount] = createSignal(0);
	const [testbedsTotalCount, setTestbedsTotalCount] = createSignal(0);
	const [benchmarksTotalCount, setBenchmarksTotalCount] = createSignal(0);
	const [plotsTotalCount, setPlotsTotalCount] = createSignal(0);

	// Display the already selected dimensions
	async function getSelected<T extends { uuid: string }>(
		perfTab: PerfTab,
		memo: T[],
		fetcher: {
			bencher_valid: InitValid;
			project_slug: undefined | string;
			param_uuids: string[];
			token: string;
		},
	) {
		const EMPTY_ARRAY: T[] = [];
		if (!fetcher.bencher_valid) {
			return EMPTY_ARRAY;
		}

		if (
			(props.isConsole && !validJwt(fetcher.token)) ||
			!fetcher.project_slug ||
			fetcher.project_slug === "undefined" ||
			props.isEmbed === true
		) {
			return EMPTY_ARRAY;
		}

		const requests = fetcher.param_uuids.map((uuid) => {
			const memo_datum = memo.find((dimension) => dimension.uuid === uuid);
			if (memo_datum) {
				return memo_datum;
			}

			const path = `/v0/projects/${fetcher.project_slug}/${perfTab}/${uuid}`;
			return httpGet(props.apiUrl, path, fetcher.token)
				.then((resp) => resp?.data as T[])
				.catch((error) => {
					console.error(error);
					Sentry.captureException(error);
					return EMPTY_ARRAY;
				});
		});

		return await Promise.all(requests);
	}

	const [branches_memo, setBranchesMemo] = createStore<JsonBranch[]>([]);
	const selectedBranchesFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			param_uuids: branches(),
			token: user?.token,
		};
	});
	const [branches_selected] = createResource<JsonBranch[]>(
		selectedBranchesFetcher,
		async (fetcher) =>
			getSelected<JsonBranch>(PerfTab.BRANCHES, branches_memo, fetcher),
	);
	createEffect(() => {
		const data = branches_selected();
		if (data) {
			setBranchesMemo(data);
		}
	});
	const handleBranchSelected = (uuid: string) => {
		const [branch_uuids, i] = removeFromArray(branches(), uuid);
		const head_uuids = heads();
		if (i !== null) {
			head_uuids.splice(i, 1);
		}
		setSearchParams({
			[BRANCHES_PARAM]: arrayToString(branch_uuids),
			[HEADS_PARAM]: arrayToString(head_uuids),
		});
	};

	const [testbeds_memo, setTestbedsMemo] = createStore<JsonTestbed[]>([]);
	const selectedTestbedFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			param_uuids: testbeds(),
			token: user?.token,
		};
	});
	const [testbeds_selected] = createResource<JsonTestbed[]>(
		selectedTestbedFetcher,
		async (fetcher) =>
			getSelected<JsonTestbed>(PerfTab.TESTBEDS, testbeds_memo, fetcher),
	);
	createEffect(() => {
		const data = testbeds_selected();
		if (data) {
			setTestbedsMemo(data);
		}
	});
	const handleTestbedSelected = (uuid: string) => {
		const [testbed_uuids, _i] = removeFromArray(testbeds(), uuid);
		setSearchParams({
			[TESTBEDS_PARAM]: arrayToString(testbed_uuids),
		});
	};

	const [benchmarks_memo, setBenchmarksMemo] = createStore<JsonBenchmark[]>([]);
	const selectedBenchmarkFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			param_uuids: benchmarks(),
			token: user?.token,
		};
	});
	const [benchmarks_selected] = createResource<JsonBenchmark[]>(
		selectedBenchmarkFetcher,
		async (fetcher) =>
			getSelected<JsonBenchmark>(PerfTab.BENCHMARKS, benchmarks_memo, fetcher),
	);
	createEffect(() => {
		const data = benchmarks_selected();
		if (data) {
			setBenchmarksMemo(data);
		}
	});
	const handleBenchmarkSelected = (uuid: string) => {
		const [benchmark_uuids, _i] = removeFromArray(benchmarks(), uuid);
		setSearchParams({
			[BENCHMARKS_PARAM]: arrayToString(benchmark_uuids),
		});
	};

	// Resource tabs data: Reports, Branches, Testbeds, Benchmarks, Plots
	async function getPerfTab<T>(
		perfTab: PerfTab,
		fetcher: {
			bencher_valid: InitValid;
			project_slug: undefined | string;
			per_page: number;
			page: number;
			start_time?: undefined | string;
			end_time?: undefined | string;
			search?: undefined | string;
			refresh: number;
			token: string;
		},
		totalCount: (headers: { [X_TOTAL_COUNT]: string }) => void,
	) {
		const EMPTY_ARRAY: T[] = [];
		if (!fetcher.bencher_valid) {
			return EMPTY_ARRAY;
		}

		if (
			(props.isConsole && !validJwt(fetcher.token)) ||
			!fetcher.project_slug ||
			fetcher.project_slug === "undefined" ||
			props.isEmbed === true ||
			!validU32(fetcher.per_page.toString()) ||
			!validU32(fetcher.page.toString())
		) {
			return EMPTY_ARRAY;
		}

		const search_params = new URLSearchParams();
		search_params.set("per_page", fetcher.per_page.toString());
		search_params.set("page", fetcher.page.toString());
		if (fetcher.start_time) {
			search_params.set("start_time", fetcher.start_time);
		}
		if (fetcher.end_time) {
			search_params.set("end_time", fetcher.end_time);
		}
		if (fetcher.search) {
			search_params.set("search", fetcher.search.trim());
		}
		const path = `/v0/projects/${
			fetcher.project_slug
		}/${perfTab}?${search_params.toString()}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				totalCount(resp?.headers);
				return resp?.data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return EMPTY_ARRAY;
			});
	}

	const reports_fetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			per_page: reports_per_page(),
			page: reports_page(),
			start_time: reports_start_time(),
			end_time: reports_end_time(),
			refresh: refresh(),
			token: user?.token,
		};
	});
	const [reports_data] = createResource(reports_fetcher, async (fetcher) =>
		getPerfTab<JsonReport>(PerfTab.REPORTS, fetcher, (headers) =>
			setReportsTotalCount(headers?.[X_TOTAL_COUNT]),
		),
	);
	createEffect(() => {
		const data = reports_data();
		if (data) {
			setReportsTab(resourcesToCheckable(data, [report()]));
		}
		const first = 0;
		const first_report = data?.[first];
		if (
			!clear() &&
			first_report &&
			branchesIsEmpty() &&
			testbedsIsEmpty() &&
			benchmarksIsEmpty() &&
			measuresIsEmpty() &&
			tab() === DEFAULT_PERF_TAB
		) {
			const benchmarks = first_report?.results?.[first]
				?.map((iteration) => iteration?.benchmark?.uuid)
				.slice(0, 10);
			const first_measure =
				first_report?.results?.[first]?.[first]?.measures?.[first]?.measure
					?.uuid;
			const start_time = dateTimeMillis(first_report?.start_time);
			setSearchParams(
				{
					[REPORT_PARAM]: first_report?.uuid,
					[BRANCHES_PARAM]: first_report?.branch?.uuid,
					[HEADS_PARAM]: first_report?.branch?.head?.uuid,
					[TESTBEDS_PARAM]: first_report?.testbed?.uuid,
					[BENCHMARKS_PARAM]: arrayToString(benchmarks ?? []),
					[MEASURES_PARAM]: first_measure,
					[PLOT_PARAM]: null,
					[START_TIME_PARAM]: start_time
						? start_time - DEFAULT_REPORT_HISTORY
						: null,
					[END_TIME_PARAM]: dateTimeMillis(first_report?.end_time),
					[LOWER_VALUE_PARAM]: null,
					[UPPER_VALUE_PARAM]: null,
					[LOWER_BOUNDARY_PARAM]:
						typeof first_measure?.boundary?.lower_limit === "number",
					[UPPER_BOUNDARY_PARAM]:
						typeof first_measure?.boundary?.upper_limit === "number",
					[CLEAR_PARAM]: true,
				},
				{ replace: true },
			);
		}
	});

	const branches_fetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			per_page: branches_per_page(),
			page: branches_page(),
			search: branches_search(),
			refresh: refresh(),
			token: user?.token,
		};
	});
	const [branches_data] = createResource(branches_fetcher, async (fetcher) =>
		getPerfTab<JsonBranch>(PerfTab.BRANCHES, fetcher, (headers) =>
			setBranchesTotalCount(headers?.[X_TOTAL_COUNT]),
		),
	);
	createEffect(() => {
		const data = branches_data();
		if (data) {
			setBranchesTab(resourcesToCheckable(data, branches()));
		}
	});

	const testbeds_fetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			per_page: testbeds_per_page(),
			page: testbeds_page(),
			search: testbeds_search(),
			refresh: refresh(),
			token: user?.token,
		};
	});
	const [testbeds_data] = createResource(testbeds_fetcher, async (fetcher) =>
		getPerfTab<JsonTestbed>(PerfTab.TESTBEDS, fetcher, (headers) =>
			setTestbedsTotalCount(headers?.[X_TOTAL_COUNT]),
		),
	);
	createEffect(() => {
		const data = testbeds_data();
		if (data) {
			setTestbedsTab(resourcesToCheckable(data, testbeds()));
		}
	});

	const benchmarks_fetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			per_page: benchmarks_per_page(),
			page: benchmarks_page(),
			search: benchmarks_search(),
			refresh: refresh(),
			token: user?.token,
		};
	});
	const [benchmarks_data] = createResource(
		benchmarks_fetcher,
		async (fetcher) =>
			getPerfTab<JsonBenchmark>(PerfTab.BENCHMARKS, fetcher, (headers) =>
				setBenchmarksTotalCount(headers?.[X_TOTAL_COUNT]),
			),
	);
	createEffect(() => {
		const data = benchmarks_data();
		if (data) {
			setBenchmarksTab(resourcesToCheckable(data, benchmarks()));
		}
	});

	const plots_fetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			project_slug: project_slug(),
			per_page: plots_per_page(),
			page: plots_page(),
			search: plots_search(),
			refresh: refresh(),
			token: user?.token,
		};
	});
	const [plots_data] = createResource(plots_fetcher, async (fetcher) =>
		getPerfTab<JsonPlot>(PerfTab.PLOTS, fetcher, (headers) =>
			setPlotsTotalCount(headers?.[X_TOTAL_COUNT]),
		),
	);
	createEffect(() => {
		const data = plots_data();
		if (data) {
			setPlotsTab(resourcesToCheckable(data, [plot()]));
		}
	});

	const handleReportChecked = (index: number) => {
		const reportUuid = reports_tab?.[index]?.resource?.uuid;
		setSearchParams({
			[REPORT_PARAM]: report() === reportUuid ? null : reportUuid,
			[CLEAR_PARAM]: true,
		});
	};
	const handleChecked = (
		resource_tab: TabList<JsonBranch | JsonTestbed | JsonBenchmark>,
		index: undefined | number,
		param: string,
		param_array: string[],
		customParams?: (checked: boolean, i: null | number) => object,
	) => {
		// Uncheck all
		if (index === undefined) {
			setSearchParams({
				[REPORT_PARAM]: null,
				[PLOT_PARAM]: null,
				[param]: null,
				[CLEAR_PARAM]: true,
			});
			return;
		}
		const item = resource_tab?.[index];
		if (!item) {
			return;
		}
		const checked = item.checked;
		if (typeof checked !== "boolean") {
			return;
		}
		const uuid = item.resource.uuid;
		const [array, i] = checked
			? removeFromArray(param_array, uuid)
			: addToArray(param_array, uuid);
		setSearchParams({
			[REPORT_PARAM]: null,
			[PLOT_PARAM]: null,
			[param]: arrayToString(array),
			[CLEAR_PARAM]: true,
			...customParams?.(checked, i),
		});
	};
	const handleBranchChecked = (index: undefined | number) => {
		handleChecked(
			branches_tab,
			index,
			BRANCHES_PARAM,
			branches(),
			(checked, i) => {
				if (i === null) {
					return {};
				}
				const array = heads();
				if (checked) {
					array.splice(i, 1);
				} else {
					const head_uuid = branches_tab?.[index]?.resource?.head?.uuid;
					array.splice(i, 0, head_uuid);
				}
				return {
					[HEADS_PARAM]: arrayToString(array),
				};
			},
		);
	};
	const handleTestbedChecked = (index: undefined | number) => {
		handleChecked(testbeds_tab, index, TESTBEDS_PARAM, testbeds());
	};
	const handleBenchmarkChecked = (index: undefined | number) => {
		handleChecked(benchmarks_tab, index, BENCHMARKS_PARAM, benchmarks());
	};
	const handleMeasure = (index: number, measure: null | string) => {
		const array = (() => {
			const m = measures();
			switch (index) {
				case 0:
					switch (m.length) {
						case 0:
						case 1:
							if (measure === null) {
								return [];
							}
							return [measure];
						default:
							if (measure === null) {
								return m.slice(1);
							}
							return [measure, ...m.slice(1)];
					}
				case 1:
					switch (m.length) {
						case 0:
							if (measure === null) {
								return [];
							}
							return [measure];
						case 1:
						case 2:
							if (measure === null) {
								return [m[0]];
							}
							return [m[0], measure];
						default:
							if (measure === null) {
								return [m[0], ...m.slice(2)];
							}
							return [m[0], measure, ...m.slice(2)];
					}
				default:
					return m;
			}
		})();
		setSearchParams({
			[REPORT_PARAM]: null,
			[MEASURES_PARAM]: arrayToString(array),
			[PLOT_PARAM]: null,
			[CLEAR_PARAM]: true,
		});
	};
	const handlePlotChecked = (index: number) => {
		const plot = plots_tab?.[index]?.resource;
		const now = Date.now();
		setSearchParams({
			[REPORT_PARAM]: null,
			[BRANCHES_PARAM]: plot?.branches?.join(","),
			[HEADS_PARAM]: null,
			[TESTBEDS_PARAM]: plot?.testbeds?.join(","),
			[BENCHMARKS_PARAM]: plot?.benchmarks?.join(","),
			[MEASURES_PARAM]: plot?.measures?.join(","),
			[PLOT_PARAM]: plot?.uuid,
			[START_TIME_PARAM]: now - (plot?.window ?? 1) * 1_000,
			[END_TIME_PARAM]: now,
			[LOWER_VALUE_PARAM]: plot?.lower_value,
			[UPPER_VALUE_PARAM]: plot?.upper_value,
			[LOWER_BOUNDARY_PARAM]: plot?.lower_boundary,
			[UPPER_BOUNDARY_PARAM]: plot?.upper_boundary,
			[CLEAR_PARAM]: true,
		});
	};

	const handleStartTime = (date: string) =>
		setSearchParams({
			[PLOT_PARAM]: null,
			[START_TIME_PARAM]: dateToTime(date),
		});
	const handleEndTime = (date: string) =>
		setSearchParams({ [PLOT_PARAM]: null, [END_TIME_PARAM]: dateToTime(date) });

	const handleTab = (tab: PerfTab) => {
		if (isPerfTab(tab)) {
			setSearchParams({ [TAB_PARAM]: tab });
		}
	};

	const handleBool = (param: string, value: boolean) => {
		if (typeof value === "boolean") {
			setSearchParams({ [PLOT_PARAM]: null, [param]: value });
		}
	};

	const handleKey = (key: boolean) => {
		handleBool(KEY_PARAM, key);
	};

	const handleXAxis = (x_axis: XAxis) => {
		if (isXAxis(x_axis)) {
			setSearchParams({ [PLOT_PARAM]: null, [X_AXIS_PARAM]: x_axis });
		}
	};

	const handleClear = (clear: boolean) => {
		if (typeof clear === "boolean") {
			if (clear) {
				setSearchParams({
					[BRANCHES_PARAM]: null,
					[HEADS_PARAM]: null,
					[TESTBEDS_PARAM]: null,
					[BENCHMARKS_PARAM]: null,
					[MEASURES_PARAM]: null,
					[PLOT_PARAM]: null,
					[START_TIME_PARAM]: null,
					[END_TIME_PARAM]: null,
					[LOWER_VALUE_PARAM]: null,
					[UPPER_VALUE_PARAM]: null,
					[LOWER_BOUNDARY_PARAM]: null,
					[UPPER_BOUNDARY_PARAM]: null,
					[X_AXIS_PARAM]: null,
					[EMBED_LOGO_PARAM]: null,
					[EMBED_TITLE_PARAM]: null,
					[EMBED_HEADER_PARAM]: null,
					[EMBED_KEY_PARAM]: null,
					[CLEAR_PARAM]: true,
				});
			} else {
				setSearchParams({ [CLEAR_PARAM]: clear });
			}
		}
	};

	const handleLowerValue = (end: boolean) => {
		handleBool(LOWER_VALUE_PARAM, end);
	};
	const handleUpperValue = (end: boolean) => {
		handleBool(UPPER_VALUE_PARAM, end);
	};

	const handleLowerBoundary = (boundary: boolean) => {
		handleBool(LOWER_BOUNDARY_PARAM, boundary);
	};
	const handleUpperBoundary = (boundary: boolean) => {
		handleBool(UPPER_BOUNDARY_PARAM, boundary);
	};

	const handleReportsPage = (page: number) =>
		setSearchParams({ [REPORTS_PAGE_PARAM]: page });
	const handleBranchesPage = (page: number) =>
		setSearchParams({ [BRANCHES_PAGE_PARAM]: page });
	const handleTestbedsPage = (page: number) =>
		setSearchParams({ [TESTBEDS_PAGE_PARAM]: page });
	const handleBenchmarksPage = (page: number) =>
		setSearchParams({ [BENCHMARKS_PAGE_PARAM]: page });
	const handlePlotsPage = (page: number) =>
		setSearchParams({ [PLOTS_PAGE_PARAM]: page });

	const handleReportsStartTime = (date: string) =>
		setSearchParams({
			[REPORTS_PAGE_PARAM]: DEFAULT_PAGE,
			[REPORTS_START_TIME_PARAM]: dateToTime(date),
		});
	const handleReportsEndTime = (date: string) =>
		setSearchParams({
			[REPORTS_PAGE_PARAM]: DEFAULT_PAGE,
			[REPORTS_END_TIME_PARAM]: dateToTime(date),
		});
	const handleBranchesSearch = debounce(
		(search: string) =>
			setSearchParams({
				[BRANCHES_PAGE_PARAM]: DEFAULT_PAGE,
				[BRANCHES_SEARCH_PARAM]: search,
			}),
		DEBOUNCE_DELAY,
	);
	const handleTestbedsSearch = debounce(
		(search: string) =>
			setSearchParams({
				[TESTBEDS_PAGE_PARAM]: DEFAULT_PAGE,
				[TESTBEDS_SEARCH_PARAM]: search,
			}),
		DEBOUNCE_DELAY,
	);
	const handleBenchmarksSearch = debounce(
		(search: string) =>
			setSearchParams({
				[BENCHMARKS_PAGE_PARAM]: DEFAULT_PAGE,
				[BENCHMARKS_SEARCH_PARAM]: search,
			}),
		DEBOUNCE_DELAY,
	);
	const handlePlotsSearch = debounce(
		(search: string) =>
			setSearchParams({
				[PLOTS_PAGE_PARAM]: DEFAULT_PAGE,
				[PLOTS_SEARCH_PARAM]: search,
			}),
		DEBOUNCE_DELAY,
	);

	return (
		<>
			<Show when={!props.isEmbed}>
				<PerfHeader
					isConsole={props.isConsole === true}
					apiUrl={props.apiUrl}
					isBencherCloud={props.isBencherCloud}
					user={user}
					project={project}
					isPlotInit={isPlotInit}
					perfQuery={perfQuery}
					lower_value={lower_value}
					upper_value={upper_value}
					lower_boundary={lower_boundary}
					upper_boundary={upper_boundary}
					x_axis={x_axis}
					branches={branches}
					testbeds={testbeds}
					benchmarks={benchmarks}
					measures={measures}
					plot={plot}
					handleRefresh={handleRefresh}
				/>
			</Show>
			<PerfFrame
				apiUrl={props.apiUrl}
				user={user}
				isConsole={props.isConsole}
				isEmbed={props.isEmbed}
				theme={theme}
				project={project}
				project_slug={project_slug}
				measuresIsEmpty={measuresIsEmpty}
				branchesIsEmpty={branchesIsEmpty}
				testbedsIsEmpty={testbedsIsEmpty}
				benchmarksIsEmpty={benchmarksIsEmpty}
				isPlotInit={isPlotInit}
				perfQuery={perfQuery}
				refresh={refresh}
				measures={measures}
				start_date={start_date}
				end_date={end_date}
				key={key}
				x_axis={x_axis}
				clear={clear}
				lower_value={lower_value}
				upper_value={upper_value}
				lower_boundary={lower_boundary}
				upper_boundary={upper_boundary}
				embed_logo={embed_logo}
				embed_title={embed_title}
				embed_header={embed_header}
				embed_key={embed_key}
				handleMeasure={handleMeasure}
				handleStartTime={handleStartTime}
				handleEndTime={handleEndTime}
				handleTab={handleTab}
				handleKey={handleKey}
				handleXAxis={handleXAxis}
				handleClear={handleClear}
				handleLowerValue={handleLowerValue}
				handleUpperValue={handleUpperValue}
				handleLowerBoundary={handleLowerBoundary}
				handleUpperBoundary={handleUpperBoundary}
			>
				<Show when={!props.isEmbed}>
					<PlotTab
						project_slug={project_slug}
						theme={theme}
						isConsole={props.isConsole === true}
						report={report}
						branches={branches}
						testbeds={testbeds}
						benchmarks={benchmarks}
						measures={measures}
						tab={tab}
						branches_selected={branches_selected}
						testbeds_selected={testbeds_selected}
						benchmarks_selected={benchmarks_selected}
						reports_data={reports_data}
						branches_data={branches_data}
						testbeds_data={testbeds_data}
						benchmarks_data={benchmarks_data}
						plots_data={plots_data}
						reports_tab={reports_tab}
						branches_tab={branches_tab}
						testbeds_tab={testbeds_tab}
						benchmarks_tab={benchmarks_tab}
						plots_tab={plots_tab}
						reports_per_page={reports_per_page}
						branches_per_page={branches_per_page}
						testbeds_per_page={testbeds_per_page}
						benchmarks_per_page={benchmarks_per_page}
						plots_per_page={plots_per_page}
						reports_page={reports_page}
						branches_page={branches_page}
						testbeds_page={testbeds_page}
						benchmarks_page={benchmarks_page}
						plots_page={plots_page}
						reports_total_count={reportsTotalCount}
						branches_total_count={branchesTotalCount}
						testbeds_total_count={testbedsTotalCount}
						benchmarks_total_count={benchmarksTotalCount}
						plots_total_count={plotsTotalCount}
						reports_start_date={reports_start_date}
						reports_end_date={reports_end_date}
						branches_search={branches_search}
						testbeds_search={testbeds_search}
						benchmarks_search={benchmarks_search}
						plots_search={plots_search}
						handleTab={handleTab}
						handleBranchSelected={handleBranchSelected}
						handleTestbedSelected={handleTestbedSelected}
						handleBenchmarkSelected={handleBenchmarkSelected}
						handleReportChecked={handleReportChecked}
						handleBranchChecked={handleBranchChecked}
						handleTestbedChecked={handleTestbedChecked}
						handleBenchmarkChecked={handleBenchmarkChecked}
						handlePlotChecked={handlePlotChecked}
						handleReportsPage={handleReportsPage}
						handleBranchesPage={handleBranchesPage}
						handleTestbedsPage={handleTestbedsPage}
						handleBenchmarksPage={handleBenchmarksPage}
						handlePlotsPage={handlePlotsPage}
						handleReportsStartTime={handleReportsStartTime}
						handleReportsEndTime={handleReportsEndTime}
						handleBranchesSearch={handleBranchesSearch}
						handleTestbedsSearch={handleTestbedsSearch}
						handleBenchmarksSearch={handleBenchmarksSearch}
						handlePlotsSearch={handlePlotsSearch}
					/>
				</Show>
			</PerfFrame>
		</>
	);
};

export default PerfPanel;
