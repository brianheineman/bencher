import * as Sentry from "@sentry/astro";
import { debounce } from "@solid-primitives/scheduled";
import type { Params } from "astro";
import bencher_valid_init, { type InitOutput } from "bencher_valid";
import {
	createEffect,
	createMemo,
	createResource,
	createSignal,
} from "solid-js";
import consoleConfig from "../../../config/console";
import {
	type BencherResource,
	Operation,
	resourcePlural,
} from "../../../config/types";
import { authUser } from "../../../util/auth";
import {
	dateToTime,
	isBoolParam,
	timeToDate,
	timeToDateOnlyIso,
} from "../../../util/convert";
import { X_TOTAL_COUNT, httpGet } from "../../../util/http";
import { NotifyKind, pageNotify } from "../../../util/notify";
import { useSearchParams } from "../../../util/url";
import { DEBOUNCE_DELAY, validJwt, validU32 } from "../../../util/valid";
import Pagination, { PaginationSize } from "../../site/Pagination";
import Table, { type TableConfig, TableState } from "./Table";
import TableHeader, { type TableHeaderConfig } from "./TableHeader";

export const PER_PAGE_PARAM = "per_page";
export const PAGE_PARAM = "page";
const START_TIME_PARAM = "start_time";
const END_TIME_PARAM = "end_time";
const SEARCH_PARAM = "search";
export const ARCHIVED_PARAM = "archived";

const DEFAULT_PER_PAGE = 8;
const DEFAULT_PAGE = 1;

interface Props {
	apiUrl: string;
	params: Params;
	resource: BencherResource;
}

interface TablePanelConfig {
	redirect: (tableData: object[]) => null | string;
	header: TableHeaderConfig;
	table: TableConfig;
}

const TablePanel = (props: Props) => {
	const [bencher_valid] = createResource(
		async () => await bencher_valid_init(),
	);
	const [searchParams, setSearchParams] = useSearchParams();

	const config = createMemo<TablePanelConfig>(
		() => consoleConfig[props.resource]?.[Operation.LIST],
	);

	const [init, setInit] = createSignal(false);
	createEffect(() => {
		if (init()) {
			return;
		}
		const initParams: Record<string, null | number | boolean> = {};
		if (!validU32(searchParams[PER_PAGE_PARAM])) {
			initParams[PER_PAGE_PARAM] = DEFAULT_PER_PAGE;
		}
		if (!validU32(searchParams[PAGE_PARAM])) {
			initParams[PAGE_PARAM] = DEFAULT_PAGE;
		}
		if (!timeToDate(searchParams[START_TIME_PARAM])) {
			initParams[START_TIME_PARAM] = null;
		}
		if (!timeToDate(searchParams[END_TIME_PARAM])) {
			initParams[END_TIME_PARAM] = null;
		}
		if (typeof searchParams[SEARCH_PARAM] !== "string") {
			initParams[SEARCH_PARAM] = null;
		}

		if (!isBoolParam(searchParams[ARCHIVED_PARAM])) {
			initParams[ARCHIVED_PARAM] = null;
		}

		if (Object.keys(initParams).length !== 0) {
			setSearchParams(initParams, { replace: true });
		}

		if (Object.keys(initParams).length === 0) {
			setInit(true);
		} else {
			setSearchParams(initParams, { replace: true });
		}
	});

	const per_page = createMemo(() =>
		Number(searchParams[PER_PAGE_PARAM] ?? DEFAULT_PER_PAGE),
	);
	const page = createMemo(() =>
		Number(searchParams[PAGE_PARAM] ?? DEFAULT_PAGE),
	);

	const start_time = createMemo(() => searchParams[START_TIME_PARAM]);
	const start_date = createMemo(() => timeToDateOnlyIso(start_time()));
	const end_time = createMemo(() => searchParams[END_TIME_PARAM]);
	const end_date = createMemo(() => timeToDateOnlyIso(end_time()));

	const search = createMemo(() => searchParams[SEARCH_PARAM]);

	const archived = createMemo(() => searchParams[ARCHIVED_PARAM]);

	const searchQuery = createMemo(() => {
		return {
			per_page: per_page(),
			page: page(),
			start_time: start_time(),
			end_time: end_time(),
			search: search(),
			archived: archived(),
		};
	});

	const fetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			searchQuery: searchQuery(),
			token: authUser()?.token,
		};
	});

	const [state, setState] = createSignal(TableState.LOADING);
	const [totalCount, setTotalCount] = createSignal(0);
	const getData = async (fetcher: {
		bencher_valid: InitOutput;
		searchQuery: {
			per_page: number;
			page: number;
			start_time: undefined | string;
			end_time: undefined | string;
			search: undefined | string;
			archived: undefined | boolean;
		};
		token: string;
	}) => {
		const EMPTY_ARRAY: object[] = [];
		if (!fetcher.bencher_valid || !validJwt(fetcher.token)) {
			return EMPTY_ARRAY;
		}
		const searchParams = new URLSearchParams();
		for (const [key, value] of Object.entries(fetcher.searchQuery)) {
			if (value) {
				searchParams.set(key, value.toString());
			}
		}
		const path = `${config()?.table?.url(
			props.params,
		)}?${searchParams.toString()}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				setState(resp?.data.length === 0 ? TableState.EMPTY : TableState.OK);
				setTotalCount(resp?.headers?.[X_TOTAL_COUNT]);
				// console.log(resp?.data);
				return resp?.data;
			})
			.catch((error) => {
				setState(TableState.ERR);
				console.error(error);
				Sentry.captureException(error);
				pageNotify(
					NotifyKind.ERROR,
					`Lettuce romaine calm! Failed to fetch ${resourcePlural(
						props.resource,
					)}. Please, try again.`,
				);
				return EMPTY_ARRAY;
			});
	};
	const [tableData, { refetch }] = createResource<object[]>(fetcher, getData);
	const tableDataLength = createMemo(() => tableData()?.length);

	const handlePage = (page: number) => {
		if (validU32(page)) {
			setSearchParams({ [PAGE_PARAM]: page }, { scroll: true });
		}
	};

	const handleStartTime = (date: string) => {
		setSearchParams(
			{ [PAGE_PARAM]: DEFAULT_PAGE, [START_TIME_PARAM]: dateToTime(date) },
			{ scroll: true },
		);
	};
	const handleEndTime = (date: string) => {
		setSearchParams(
			{ [PAGE_PARAM]: DEFAULT_PAGE, [END_TIME_PARAM]: dateToTime(date) },
			{ scroll: true },
		);
	};
	const handleSearch = debounce(
		(search: string) =>
			setSearchParams(
				{ [PAGE_PARAM]: DEFAULT_PAGE, [SEARCH_PARAM]: search },
				{ scroll: true },
			),
		DEBOUNCE_DELAY,
	);

	const handleArchived = () => {
		setSearchParams(
			{
				[PAGE_PARAM]: DEFAULT_PAGE,
				[ARCHIVED_PARAM]: !(archived() === "true"),
			},
			{ scroll: true },
		);
	};

	return (
		<>
			<TableHeader
				apiUrl={props.apiUrl}
				params={props.params}
				config={config()?.header}
				start_date={start_date}
				end_date={end_date}
				search={search}
				archived={archived}
				handleRefresh={refetch}
				handleStartTime={handleStartTime}
				handleEndTime={handleEndTime}
				handleSearch={handleSearch}
				handleArchived={handleArchived}
			/>
			<Table
				config={config()?.table}
				state={state}
				tableData={tableData}
				start_date={start_date}
				end_date={end_date}
				search={search}
				page={page}
				handlePage={handlePage}
			/>
			<section class="section">
				<div class="container">
					<Pagination
						size={PaginationSize.REGULAR}
						data_len={tableDataLength}
						per_page={per_page}
						page={page}
						total_count={totalCount}
						handlePage={handlePage}
					/>
				</div>
			</section>
		</>
	);
};

export default TablePanel;
