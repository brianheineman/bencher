import * as Sentry from "@sentry/astro";
import {
	type Accessor,
	For,
	Match,
	type Resource,
	Show,
	Switch,
	createEffect,
	createMemo,
	createResource,
	createSignal,
} from "solid-js";
import { resourcePath } from "../../../../config/util";
import {
	type JsonAuthUser,
	type JsonMeasure,
	type JsonProject,
	XAxis,
} from "../../../../types/bencher";
import { httpGet } from "../../../../util/http";
import { BACK_PARAM, encodePath } from "../../../../util/url";
import { type Theme, themeWordmark } from "../../../navbar/theme/theme";
import { BENCHER_MEASURE_ID } from "./util";

const BENCHER_MEASURE = "--bencher-measure--";

export interface Props {
	apiUrl: string;
	user: JsonAuthUser;
	project: Resource<JsonProject> | undefined;
	project_slug: Accessor<undefined | string>;
	theme: Accessor<Theme>;
	isConsole: boolean;
	isEmbed: boolean;
	isPlotInit: Accessor<boolean>;
	measures: Accessor<string[]>;
	start_date: Accessor<undefined | string>;
	end_date: Accessor<undefined | string>;
	refresh: () => void;
	x_axis: Accessor<XAxis>;
	clear: Accessor<boolean>;
	lower_value: Accessor<boolean>;
	upper_value: Accessor<boolean>;
	lower_boundary: Accessor<boolean>;
	upper_boundary: Accessor<boolean>;
	embed_logo: Accessor<boolean>;
	embed_title: Accessor<undefined | string>;
	embed_header: Accessor<boolean>;
	handleMeasure: (index: number, slug: null | string) => void;
	handleStartTime: (start_time: string) => void;
	handleEndTime: (end_time: string) => void;
	handleXAxis: (x_axis: XAxis) => void;
	handleClear: (clear: boolean) => void;
	handleLowerValue: (lower_value: boolean) => void;
	handleUpperValue: (upper_value: boolean) => void;
	handleLowerBoundary: (lower_boundary: boolean) => void;
	handleUpperBoundary: (upper_boundary: boolean) => void;
}

const PlotHeader = (props: Props) => {
	return (
		<Show when={props.isEmbed} fallback={<FullPlotHeader {...props} />}>
			<EmbedPlotHeader {...props} />
		</Show>
	);
};

const FullPlotHeader = (props: Props) => {
	const measures_fetcher = createMemo(() => {
		return {
			project: props.project_slug(),
			refresh: props.refresh(),
			token: props.user?.token,
		};
	});
	const getMeasures = async (fetcher: {
		project: undefined | string;
		refresh: () => void;
		token: undefined | string;
	}) => {
		const SELECT_MEASURE = {
			name: "Select Measure",
			uuid: BENCHER_MEASURE,
		};
		if (!fetcher.project) {
			return [SELECT_MEASURE];
		}
		if (props.isConsole && typeof fetcher.token !== "string") {
			return [SELECT_MEASURE];
		}
		// Always use the first page and the max number of results per page
		const searchParams = new URLSearchParams();
		searchParams.set("per_page", "255");
		searchParams.set("page", "1");
		const path = `/v0/projects/${
			fetcher.project
		}/measures?${searchParams.toString()}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				const data = [SELECT_MEASURE, ...(resp?.data ?? [])];
				return data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return [SELECT_MEASURE];
			});
	};
	const [measures] = createResource<JsonMeasure[]>(
		measures_fetcher,
		getMeasures,
	);

	const [secondMeasure, setSecondMeasure] = createSignal(
		props.measures().length > 1,
	);
	createEffect(() => {
		setSecondMeasure(props.measures().length > 1);
	});

	return (
		<nav class="panel-heading">
			<div class="columns is-vcentered">
				<MeasureSelect
					isConsole={props.isConsole}
					project_slug={props.project_slug}
					measures={props.measures}
					json_measures={measures}
					index={0}
					handleMeasure={props.handleMeasure}
				/>
				<Show when={props.measures().length >= 1}>
					<Show
						when={secondMeasure()}
						fallback={
							<div class="column is-narrow">
								<button
									class="button is-small is-rounded"
									type="button"
									title="Add a second Measure"
									onMouseDown={(e) => {
										e.preventDefault();
										setSecondMeasure(true);
									}}
								>
									<span class="icon">
										<i class="fas fa-plus" />
									</span>
								</button>
							</div>
						}
					>
						<MeasureSelect
							isConsole={props.isConsole}
							project_slug={props.project_slug}
							measures={props.measures}
							json_measures={measures}
							index={1}
							handleMeasure={props.handleMeasure}
							removeSecondMeasure={() => setSecondMeasure(false)}
						/>
					</Show>
				</Show>
				<div class="column" />
				<SharedPlot {...props} />
			</div>
		</nav>
	);
};

const MeasureSelect = (props: {
	isConsole: boolean;
	project_slug: Accessor<undefined | string>;
	measures: Accessor<string[]>;
	json_measures: Resource<JsonMeasure[]>;
	index: number;
	handleMeasure: (index: number, slug: null | string) => void;
	removeSecondMeasure?: () => void;
}) => {
	const measure = createMemo(() =>
		props
			.json_measures()
			?.find((measure) => props.measures()?.[props.index] === measure.uuid),
	);

	const getSelected = () => {
		const uuid = props.measures()?.[props.index];
		if (uuid) {
			return uuid;
		}
		return BENCHER_MEASURE;
	};
	const [selected, setSelected] = createSignal(getSelected());

	createEffect(() => {
		setSelected(getSelected());
	});

	const handleInput = (uuid: string) => {
		if (uuid === BENCHER_MEASURE) {
			props.handleMeasure(props.index, null);
		} else {
			props.handleMeasure(props.index, uuid);
		}
	};

	return (
		<div class="column is-narrow">
			<div class="level is-mobile" style="margin-bottom: 0.5rem;">
				<div class="level-left">
					<div class="level-item">
						<p id={BENCHER_MEASURE_ID} class="level-item">
							Measure
						</p>
						<Switch>
							<Match when={measure() && measure()?.uuid !== BENCHER_MEASURE}>
								<a
									class="level-item button is-small is-rounded"
									style="margin-left: 1rem;"
									title={`${props.isConsole ? "Manage" : "View"} ${
										measure()?.name
									}`}
									href={`
										${resourcePath(
											props.isConsole,
										)}/${props.project_slug()}/measures/${
											measure()?.slug
										}?${BACK_PARAM}=${encodePath()}`}
								>
									<small>{props.isConsole ? "Manage" : "View"}</small>
								</a>
							</Match>
							<Match when={props.index === 1 && props.removeSecondMeasure}>
								<button
									class="level-item button is-small is-rounded"
									type="button"
									style="margin-left: 1rem; font-size: 0.5em;"
									title="Hide add a second Measure"
									onMouseDown={(e) => {
										e.preventDefault();
										props.removeSecondMeasure();
									}}
								>
									<span class="icon is-small">
										<i class="fas fa-minus" />
									</span>
								</button>
							</Match>
						</Switch>
					</div>
				</div>
			</div>
			<select
				class="card-header-title level-item"
				style="color: black;"
				title="Select Measure"
				onInput={(e) => handleInput(e.currentTarget.value)}
			>
				<For each={props.json_measures() ?? []}>
					{(measure: { name: string; uuid: string }) => (
						<option value={measure.uuid} selected={measure.uuid === selected()}>
							{measure.name}
						</option>
					)}
				</For>
			</select>
		</div>
	);
};

const EmbedPlotHeader = (props: Props) => {
	const perfUrl = createMemo(() => {
		const location = window.location;
		return `${location.protocol}//${location.hostname}${
			location.port ? `:${location.port}` : ""
		}/perf/${props.project?.()?.slug ?? props.project_slug()}/${location.search}`;
	});

	const logo = createMemo(() => {
		const embedLogo = props.embed_logo();
		if (embedLogo === false) {
			return <></>;
		}
		return (
			<a href={perfUrl()} target="_blank" rel="noreferrer">
				<img
					src={themeWordmark(props.theme())}
					width="128em"
					alt="🐰 Bencher"
				/>
			</a>
		);
	});

	const title = createMemo(() => {
		const embedTitle = props.embed_title();
		switch (embedTitle) {
			case "":
				return <></>;
			default:
				return (
					<h1 class="title is-3" style="word-break: break-word;">
						{embedTitle ?? props.project?.()?.name ?? "Bencher Project"}
					</h1>
				);
		}
	});

	return (
		<nav class="panel-heading">
			<div class="columns is-mobile is-centered is-vcentered is-gapless">
				<div class="column has-text-centered">
					{logo()}
					{title()}
				</div>
			</div>
			<Show when={props.embed_header()}>
				<div class="columns is-centered is-vcentered">
					<SharedPlot {...props} />
				</div>
			</Show>
		</nav>
	);
};

const SharedPlot = (props: Props) => {
	const xAxisIcon = createMemo(() => {
		switch (props.x_axis()) {
			case XAxis.DateTime:
				return <i class="far fa-calendar" />;
			case XAxis.Version:
				return <i class="fas fa-code-branch" />;
		}
	});

	return (
		<>
			<Show when={!props.isPlotInit()}>
				<div class="column is-narrow">
					<div class="level is-mobile" style="margin-bottom: 0;">
						<div class="level-item" title="Display lower/upper Metric values">
							<span style="padding-left: 1em; padding-right: 1em">Value</span>
						</div>
					</div>
					<div class="level is-mobile">
						<div class="level-item">
							<LineArrowButton
								param_key={props.lower_value}
								handleParamKey={props.handleLowerValue}
								position="Lower Value"
								arrow="down"
							/>
							<LineArrowButton
								param_key={props.upper_value}
								handleParamKey={props.handleUpperValue}
								position="Upper Value"
								arrow="up"
							/>
						</div>
					</div>
				</div>
				<div class="column is-narrow">
					<div class="level is-mobile" style="margin-bottom: 0;">
						<div
							class="level-item"
							title="Display lower/upper Threshold Boundary Limits"
						>
							Boundary
						</div>
					</div>
					<div class="level is-mobile">
						<div class="level-item">
							<LineArrowButton
								param_key={props.lower_boundary}
								handleParamKey={props.handleLowerBoundary}
								position="Lower Boundary"
								arrow="down"
							/>
							<LineArrowButton
								param_key={props.upper_boundary}
								handleParamKey={props.handleUpperBoundary}
								position="Upper Boundary"
								arrow="up"
							/>
						</div>
					</div>
				</div>
				<div class="column is-narrow">
					<div class="level is-mobile" style="margin-bottom: 0;">
						<div
							class="level-item"
							title="Toggle X-Axis between Date and Branch Version"
						>
							X-Axis
						</div>
					</div>
					<button
						class="button is-fullwidth"
						type="button"
						title={(() => {
							switch (props.x_axis()) {
								case XAxis.DateTime:
									return "Switch X-Axis to Branch Version";
								case XAxis.Version:
									return "Switch X-Axis to Date";
							}
						})()}
						onMouseDown={(e) => {
							e.preventDefault();
							switch (props.x_axis()) {
								case XAxis.DateTime:
									props.handleXAxis(XAxis.Version);
									break;
								case XAxis.Version:
									props.handleXAxis(XAxis.DateTime);
									break;
							}
						}}
					>
						<span class="icon">{xAxisIcon()}</span>
					</button>
				</div>
			</Show>
			<div class="column is-narrow">
				<div class="level is-mobile">
					<div class="level-item">
						<div class="columns">
							<div class="column">
								<p title="Select a start date">Start Date</p>
								<input
									title="Start Date"
									type="date"
									value={props.start_date() ?? ""}
									onInput={(e) => props.handleStartTime(e.currentTarget?.value)}
								/>
							</div>
						</div>
					</div>
					<div class="level-item">
						<div class="columns">
							<div class="column">
								<p title="Select an end date">End Date</p>
								<input
									title="End Date"
									type="date"
									value={props.end_date() ?? ""}
									onInput={(e) => props.handleEndTime(e.currentTarget?.value)}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
			<Show when={!props.isPlotInit() && !props.isEmbed}>
				<div class="column is-narrow">
					<p
						class="has-text-centered"
						style="padding-left: 0.5em; padding-right: 0.5em;"
						title="Clear the current query"
					>
						Clear
					</p>
					<button
						class="button is-fullwidth"
						type="reset"
						title="Clear Query"
						onMouseDown={(e) => {
							e.preventDefault();
							props.handleClear(true);
						}}
					>
						<span class="icon">
							<i class="fas fa-times-circle" />
						</span>
					</button>
				</div>
			</Show>
		</>
	);
};

const LineArrowButton = (props: {
	param_key: Accessor<boolean>;
	handleParamKey: (param_key: boolean) => void;
	position: string;
	arrow: string;
}) => {
	return (
		<button
			class={`button ${props.param_key() ? "is-primary" : ""} is-fullwidth`}
			type="button"
			title={`${props.param_key() ? "Hide" : "Show"} ${props.position}`}
			onMouseDown={(e) => {
				e.preventDefault();
				props.handleParamKey(!props.param_key());
			}}
		>
			<span class="icon">
				<i class={`fas fa-arrow-${props.arrow}`} />
			</span>
		</button>
	);
};
export default PlotHeader;
