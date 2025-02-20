import type { Params } from "astro";
import {
	type Accessor,
	For,
	Match,
	type Resource,
	Show,
	Switch,
} from "solid-js";
import { Row } from "../../../config/types";
import { fmtDateTime } from "../../../config/util";
import {
	AlertStatus,
	type JsonAlert,
	type JsonReport,
	type JsonThreshold,
	type Slug,
} from "../../../types/bencher";
import { fmtValues } from "../../../util/resource";
import { BACK_PARAM, encodePath, pathname } from "../../../util/url";
import FallbackTable from "./FallbackTable";
import ReportRow from "./rows/ReportRow";
import ThresholdRow from "./rows/ThresholdRow";
import AlertRow from "./rows/AlertRow";

export enum TableState {
	LOADING = 0,
	EMPTY = 1,
	OK = 2,
	ERR = 3,
}

export interface Props {
	config: TableConfig;
	state: Accessor<TableState>;
	tableData: Resource<object[]>;
	start_date: Accessor<undefined | string>;
	end_date: Accessor<undefined | string>;
	search: Accessor<undefined | string>;
	page: Accessor<number>;
	handlePage: (page: number) => void;
}

export interface TableConfig {
	url: (params: Params) => string;
	name: string;
	add?: AddButtonConfig;
	row: RowConfig;
}

const Table = (props: Props) => {
	return (
		<Switch fallback={<p>ERROR: Unknown table state</p>}>
			<Match when={props.state() === TableState.LOADING}>
				<FallbackTable />
			</Match>
			<Match when={props.state() === TableState.EMPTY}>
				<Show
					when={
						props.config?.add &&
						!props.start_date() &&
						!props.end_date() &&
						!props.search()
					}
					fallback={<p>🐰 No {props.config?.name} found</p>}
				>
					<AddButton config={props.config?.add as AddButtonConfig} />
				</Show>
			</Match>
			<Match when={props.state() === TableState.OK}>
				<For each={props.tableData()}>
					{(datum, _i) => (
						<a
							class="box"
							style="margin-bottom: 1rem;"
							href={rowHref(props.config?.row?.button, datum)}
							onMouseDown={(_e) => rowEffect(props.config?.row?.button, datum)}
						>
							<Switch fallback={rowText(props.config?.row, datum)}>
								<Match when={props.config?.row?.kind === Row.REPORT}>
									<ReportRow report={datum as JsonReport} />
								</Match>
								<Match when={props.config?.row?.kind === Row.THRESHOLD}>
									<ThresholdRow threshold={datum as JsonThreshold} />
								</Match>
								<Match when={props.config?.row?.kind === Row.ALERT}>
									<AlertRow alert={datum as JsonAlert} />
								</Match>
							</Switch>
						</a>
					)}
				</For>
			</Match>
			<Match when={props.state() === TableState.ERR}>
				<LogoutButton />
			</Match>
		</Switch>
	);
};

export interface AddButtonConfig {
	prefix: Element;
	path: (pathname: string) => string;
	text: string;
}

const AddButton = (props: {
	config: AddButtonConfig;
}) => {
	return (
		<>
			<div class="content has-text-centered">{props.config?.prefix}</div>
			<a
				class="button is-primary is-fullwidth"
				href={`${props.config?.path?.(
					pathname(),
				)}?${BACK_PARAM}=${encodePath()}`}
			>
				{props.config?.text}
			</a>
		</>
	);
};

export interface RowConfig {
	kind?: Row;
	key: string;
	keys?: string[][];
	items: ItemConfig[];
	button: RowsButtonConfig;
}

export interface ItemConfig {
	kind: Row;
	key?: string;
	keys?: string[];
	text?: string;
	value?: { options: { option: string; value: string }[] };
}

export interface RowsButtonConfig {
	text: string;
	path: (pathname: string, datum: { [slug: string]: Slug }) => string;
	effect: (datum: { [slug: string]: Slug }) => void;
}

const rowText = (config: RowConfig, datum: Record<string, string>) => {
	if (config?.kind === Row.DATE_TIME && config?.key) {
		return fmtDateTime(datum[config?.key] ?? "");
	}
	return fmtValues(datum, config?.key, config?.keys, " | ");
};

const rowHref = (config: RowsButtonConfig, datum: Record<string, string>) =>
	`${config?.path?.(pathname(), datum)}?${BACK_PARAM}=${encodePath()}`;

const rowEffect = (config: RowsButtonConfig, datum: Record<string, string>) =>
	config?.effect?.(datum);

const LogoutButton = () => {
	return (
		<>
			<div class="content has-text-centered">Failed to fetch data...</div>
			<div class="columns is-centered">
				<div class="column is-one-third">
					<a class="button is-primary is-fullwidth" href="/auth/logout">
						Log out
					</a>
				</div>
			</div>
		</>
	);
};

export default Table;
