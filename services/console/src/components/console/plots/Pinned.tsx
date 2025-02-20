import * as Sentry from "@sentry/astro";
import type { Params } from "astro";
import {
	type Accessor,
	Match,
	type Resource,
	Show,
	Switch,
	createMemo,
	createResource,
	createSignal,
} from "solid-js";
import { PLOT_FIELDS } from "../../../config/project/plot";
import { Card, Display } from "../../../config/types";
import { perfPath } from "../../../config/util";
import type { JsonAuthUser, JsonPlot } from "../../../types/bencher";
import { httpGet, httpPatch } from "../../../util/http";
import Field, { type FieldHandler } from "../../field/Field";
import FieldKind from "../../field/kind";
import DeleteButton from "../deck/hand/DeleteButton";
import DeckCard from "../deck/hand/card/DeckCard";
import PinnedFrame from "./PinnedFrame";
import { plotQueryString } from "./util";

enum PinnedState {
	Front = "front",
	Rank = "rank",
	Settings = "settings",
}

const Pinned = (props: {
	isConsole: boolean;
	apiUrl: string;
	params: Params;
	user: JsonAuthUser;
	project_slug: Accessor<undefined | string>;
	isAllowedEdit: Resource<boolean>;
	isAllowedDelete: Resource<boolean>;
	plot: JsonPlot;
	index: Accessor<number>;
	total: Accessor<number>;
	movePlot: (from: number, to: number) => void;
	updatePlot: (index: number, plot: JsonPlot) => void;
	removePlot: (index: number) => void;
	search: Accessor<undefined | string>;
}) => {
	const [state, setState] = createSignal(PinnedState.Front);

	const [refresh, setRefresh] = createSignal(false);
	const handleRefresh = () => {
		setRefresh(true);
	};
	const plotFetcher = createMemo(() => {
		return {
			plot: props.plot,
			token: props.user?.token,
			refresh: refresh(),
		};
	});
	const getPlot = async (fetcher: {
		plot: JsonPlot;
		token: string;
		refresh: boolean;
	}) => {
		if (!fetcher.refresh) {
			return fetcher.plot;
		}
		setRefresh(false);
		const path = `/v0/projects/${fetcher.plot?.project}/plots/${fetcher.plot?.uuid}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				const p = resp?.data as JsonPlot;
				props.updatePlot(props.index(), p);
				return p;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return fetcher.plot;
			});
	};
	const [plot] = createResource<JsonPlot>(plotFetcher, getPlot);

	return (
		<PinnedFrame
			isConsole={props.isConsole}
			apiUrl={props.apiUrl}
			user={props.user}
			project_slug={props.project_slug}
			plot={props.plot}
			embed={{ key: true }}
		>
			<div class="box">
				<PinnedButtons
					isConsole={props.isConsole}
					apiUrl={props.apiUrl}
					user={props.user}
					project_slug={props.project_slug}
					isAllowedEdit={props.isAllowedEdit}
					plot={plot()}
					index={props.index}
					total={props.total}
					movePlot={props.movePlot}
					search={props.search}
					state={state}
					handleState={setState}
				/>
				<Switch>
					<Match when={state() === PinnedState.Rank}>
						<PinnedRank
							apiUrl={props.apiUrl}
							params={props.params}
							user={props.user}
							isAllowedEdit={props.isAllowedEdit}
							plot={plot()}
							index={props.index}
							total={props.total}
							movePlot={props.movePlot}
							handleState={setState}
						/>
					</Match>
					<Match when={state() === PinnedState.Settings}>
						<PinnedSetting
							isConsole={props.isConsole}
							apiUrl={props.apiUrl}
							params={props.params}
							user={props.user}
							isAllowedEdit={props.isAllowedEdit}
							isAllowedDelete={props.isAllowedDelete}
							plot={plot()}
							index={props.index}
							removePlot={props.removePlot}
							refresh={handleRefresh}
							handleState={setState}
							handleRefresh={handleRefresh}
						/>
					</Match>
				</Switch>
			</div>
		</PinnedFrame>
	);
};

const PinnedButtons = (props: {
	isConsole: boolean;
	apiUrl: string;
	user: JsonAuthUser;
	project_slug: Accessor<undefined | string>;
	isAllowedEdit: Resource<boolean>;
	plot: JsonPlot;
	index: Accessor<number>;
	total: Accessor<number>;
	movePlot: (from: number, to: number) => void;
	search: Accessor<undefined | string>;
	state: Accessor<PinnedState>;
	handleState: (state: PinnedState) => void;
}) => {
	const [rank, setRank] = createSignal(-1);

	const rankFetcher = createMemo(() => {
		return {
			token: props.user.token,
			plot: props.plot,
			rank: rank(),
		};
	});
	const patchRank = async (fetcher: {
		token: string;
		plot: JsonPlot;
		rank: number;
	}) => {
		if (fetcher.rank < 0) {
			return fetcher.plot;
		}
		setRank(-1);
		const path = `/v0/projects/${fetcher.plot?.project}/plots/${fetcher.plot?.uuid}`;
		const data = {
			index: fetcher.rank,
		};
		return await httpPatch(props.apiUrl, path, fetcher.token, data)
			.then((resp) => {
				props.movePlot(props.index(), fetcher.rank);
				props.handleState(PinnedState.Front);
				return resp?.data;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return;
			});
	};
	const [_rank] = createResource<JsonPlot>(rankFetcher, patchRank);

	return (
		<nav class="level is-mobile">
			<div class="level-left">
				<Show when={props.search() === undefined}>
					<div class="level is-mobile">
						<div class="level-item">
							<button
								type="button"
								class={`button is-small is-rounded${
									props.state() === PinnedState.Rank ? " is-active" : ""
								}`}
								title="Move plot"
								disabled={!props.isAllowedEdit()}
								onMouseDown={(e) => {
									e.preventDefault();
									switch (props.state()) {
										case PinnedState.Rank:
											props.handleState(PinnedState.Front);
											break;
										default:
											props.handleState(PinnedState.Rank);
											break;
									}
								}}
							>
								{props.index() + 1}
							</button>
						</div>
						<Show when={props.isAllowedEdit()}>
							<div class="level-item">
								<div class="buttons has-addons">
									<button
										type="button"
										class="button is-small"
										title="Move plot down"
										disabled={props.index() === props.total() - 1}
										onMouseDown={(e) => {
											e.preventDefault();
											// Because the ranking algorithm looks backwards,
											// we need to jump ahead, further down the list by two instead of one.
											// Otherwise, the plot will be placed in the same position, albeit with a different rank.
											setRank(props.index() + 1);
										}}
									>
										<span class="icon is-small">
											<i class="fas fa-chevron-down" />
										</span>
									</button>
									<button
										type="button"
										class="button is-small"
										title="Move plot up"
										disabled={props.index() === 0}
										onMouseDown={(e) => {
											e.preventDefault();
											setRank(props.index() - 1);
										}}
									>
										<span class="icon is-small">
											<i class="fas fa-chevron-up" />
										</span>
									</button>
								</div>
							</div>
						</Show>
					</div>
				</Show>
			</div>

			<div class="level-right">
				<div class="buttons">
					<a
						type="button"
						class="button is-small"
						title="View plot"
						href={`${perfPath(
							props.isConsole,
							props.project_slug(),
						)}?${plotQueryString(props.plot)}&tab=plots&plot=${
							props.plot?.uuid
						}&plots_search=${props.plot?.uuid}`}
					>
						<span class="icon is-small">
							<i class="fas fa-external-link-alt" />
						</span>
					</a>
					<button
						type="button"
						class={`button is-small${
							props.state() === PinnedState.Settings ? " is-active" : ""
						}`}
						title="Plot settings"
						onMouseDown={(e) => {
							e.preventDefault();
							switch (props.state()) {
								case PinnedState.Settings:
									props.handleState(PinnedState.Front);
									break;
								default:
									props.handleState(PinnedState.Settings);
									break;
							}
						}}
					>
						<span class="icon is-small">
							<i class="fas fa-cog" />
						</span>
					</button>
				</div>
			</div>
		</nav>
	);
};

const PinnedRank = (props: {
	apiUrl: string;
	params: Params;
	user: JsonAuthUser;
	isAllowedEdit: Resource<boolean>;
	plot: JsonPlot;
	index: Accessor<number>;
	total: Accessor<number>;
	movePlot: (from: number, to: number) => void;
	handleState: (state: PinnedState) => void;
}) => {
	const [rank, setRank] = createSignal(props.index() + 1);
	const [valid, setValid] = createSignal(true);
	const [submitting, setSubmitting] = createSignal(false);

	const handleField: FieldHandler = (_key, value, valid) => {
		setRank(value);
		setValid(valid);
	};

	const rankFetcher = createMemo(() => {
		return {
			token: props.user.token,
			plot: props.plot,
			rank: rank(),
			submitting: submitting(),
		};
	});
	const patchRank = async (fetcher: {
		token: string;
		plot: JsonPlot;
		rank: number;
	}) => {
		if (!submitting()) {
			return;
		}
		const path = `/v0/projects/${fetcher.plot?.project}/plots/${fetcher.plot?.uuid}`;
		const data = {
			index: fetcher.rank - 1,
		};
		return await httpPatch(props.apiUrl, path, fetcher.token, data)
			.then((resp) => {
				setSubmitting(false);
				props.movePlot(props.index(), fetcher.rank - 1);
				props.handleState(PinnedState.Front);
				return resp?.data;
			})
			.catch((error) => {
				setSubmitting(false);
				console.error(error);
				Sentry.captureException(error);
				return;
			});
	};
	const [_rank] = createResource<JsonPlot>(rankFetcher, patchRank);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				setSubmitting(true);
			}}
		>
			<Field
				kind={FieldKind.PLOT_RANK}
				fieldKey="rank"
				label="Move Plot"
				value={rank()}
				valid={valid()}
				config={{
					bottom: "Move to bottom",
					top: "Move to top",
					total: props.total(),
					help: PLOT_FIELDS.index.help,
				}}
				handleField={handleField}
			/>
			<br />
			<button
				class="button is-primary is-fullwidth is-small"
				type="button"
				disabled={
					!valid() ||
					Number.parseInt(rank()?.toString()) === props.index() + 1 ||
					submitting()
				}
				onMouseDown={(e) => {
					e.preventDefault();
					setSubmitting(true);
				}}
			>
				Move
			</button>
		</form>
	);
};

const PinnedSetting = (props: {
	isConsole: boolean;
	apiUrl: string;
	params: Params;
	user: JsonAuthUser;
	isAllowedEdit: Resource<boolean>;
	isAllowedDelete: Resource<boolean>;
	plot: JsonPlot;
	index: Accessor<number>;
	removePlot: (index: number) => void;
	refresh: () => void;
	handleState: (state: PinnedState) => void;
	handleRefresh: () => void;
}) => {
	const path = createMemo(
		() => `/v0/projects/${props.plot?.project}/plots/${props.plot?.uuid}`,
	);

	const handleUpdate = () => {
		props.handleRefresh();
		props.handleState(PinnedState.Front);
	};

	const handleDelete = () => {
		props.removePlot(props.index());
		props.handleState(PinnedState.Front);
	};

	return (
		<>
			<DeckCard
				isConsole={props.isConsole}
				apiUrl={props.apiUrl}
				params={props.params}
				user={props.user}
				path={path}
				card={{
					kind: Card.FIELD,
					label: "Title",
					key: "title",
					display: Display.RAW,
					is_allowed: (_apiUrl, _params) => props.isAllowedEdit() === true,
					notify: false,
					field: {
						kind: FieldKind.INPUT,
						label: "Title",
						key: "title",
						value: props.plot?.title ?? "",
						valid: null,
						validate: true,
						nullable: true,
						config: PLOT_FIELDS.title,
					},
				}}
				data={() => props.plot}
				handleRefresh={handleUpdate}
				handleLoopback={handleUpdate}
			/>
			<DeckCard
				isConsole={props.isConsole}
				apiUrl={props.apiUrl}
				params={props.params}
				user={props.user}
				path={path}
				card={{
					kind: Card.FIELD,
					label: "Window (seconds)",
					key: "window",
					display: Display.RAW,
					is_allowed: (_apiUrl, _params) => props.isAllowedEdit() === true,
					notify: false,
					field: {
						kind: FieldKind.PLOT_WINDOW,
						label: "Window (seconds)",
						key: "window",
						value: props.plot?.window ?? "",
						valid: null,
						validate: true,
						nullable: true,
						config: PLOT_FIELDS.window,
					},
				}}
				data={() => props.plot}
				handleRefresh={handleUpdate}
				handleLoopback={handleUpdate}
			/>
			<DeckCard
				isConsole={props.isConsole}
				apiUrl={props.apiUrl}
				params={props.params}
				user={props.user}
				path={path}
				card={{
					kind: Card.FIELD,
					label: "Plot Page",
					key: "uuid",
					display: Display.PLOT_URL,
					notify: false,
				}}
				data={() => props.plot}
				handleRefresh={handleUpdate}
				handleLoopback={handleUpdate}
			/>
			<br />
			<Show when={props.isAllowedDelete()}>
				<DeleteButton
					apiUrl={props.apiUrl}
					user={props.user}
					path={path}
					data={() => props.plot}
					subtitle="This plot will be unpinned."
					redirect={handleDelete}
					notify={false}
				/>
			</Show>
		</>
	);
};

export default Pinned;
