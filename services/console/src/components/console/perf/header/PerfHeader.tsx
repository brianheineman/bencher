import {
	type Accessor,
	type Resource,
	Show,
	createEffect,
	createMemo,
	createResource,
	createSignal,
} from "solid-js";
import { resourcePath } from "../../../../config/util";
import {
	type JsonAuthUser,
	type JsonPerfQuery,
	type JsonProject,
	Visibility,
	type XAxis,
} from "../../../../types/bencher";
import { isAllowedProjectManage } from "../../../../util/auth";
import { setPageTitle } from "../../../../util/resource";
import PinModal from "./PinModal";
import ShareModal from "./ShareModal";

export interface Props {
	isConsole: boolean;
	apiUrl: string;
	isBencherCloud: boolean;
	user: JsonAuthUser;
	project: Resource<JsonProject>;
	isPlotInit: Accessor<boolean>;
	perfQuery: Accessor<JsonPerfQuery>;
	lower_value: Accessor<boolean>;
	upper_value: Accessor<boolean>;
	lower_boundary: Accessor<boolean>;
	upper_boundary: Accessor<boolean>;
	x_axis: Accessor<XAxis>;
	branches: Accessor<string[]>;
	testbeds: Accessor<string[]>;
	benchmarks: Accessor<string[]>;
	measures: Accessor<string[]>;
	plot: Accessor<undefined | string>;
	handleRefresh: () => void;
}

const PerfHeader = (props: Props) => {
	const [share, setShare] = createSignal(false);
	const [pin, setPin] = createSignal(false);

	const isAllowedFetcher = createMemo(() => {
		return {
			apiUrl: props.apiUrl,
			project: props.project(),
		};
	});
	const [isAllowed] = createResource(
		isAllowedFetcher,
		async ({ apiUrl, project }) =>
			isAllowedProjectManage(apiUrl, {
				project: project?.uuid,
			}),
	);
	const showPin = createMemo(() => isAllowed() && props.plot() === undefined);

	createEffect(() => {
		setPageTitle(props.project()?.name);
	});

	return (
		<div class="columns">
			<div class="column">
				<h1 class="title is-3" style="word-break: break-word;">
					{props.project()?.name}
				</h1>
			</div>
			<ShareModal
				apiUrl={props.apiUrl}
				isBencherCloud={props.isBencherCloud}
				user={props.user}
				perfQuery={props.perfQuery}
				isPlotInit={props.isPlotInit}
				project={props.project}
				share={share}
				setShare={setShare}
			/>
			<PinModal
				apiUrl={props.apiUrl}
				user={props.user}
				project={props.project}
				isPlotInit={props.isPlotInit}
				perfQuery={props.perfQuery}
				lower_value={props.lower_value}
				upper_value={props.upper_value}
				lower_boundary={props.lower_boundary}
				upper_boundary={props.upper_boundary}
				x_axis={props.x_axis}
				branches={props.branches}
				testbeds={props.testbeds}
				benchmarks={props.benchmarks}
				measures={props.measures}
				pin={pin}
				setPin={setPin}
			/>
			<div class="column is-narrow">
				<nav class="level">
					<div class="level-right">
						<Show when={props.project()?.url}>
							<div class="level-item">
								<a
									class="button is-fullwidth"
									title={`View ${props.project()?.name} website`}
									href={props.project()?.url ?? ""}
									rel="noreferrer nofollow"
									target="_blank"
								>
									<span class="icon">
										<i class="fas fa-globe" />
									</span>
									<span>Website</span>
								</a>
							</div>
						</Show>
						<nav class="level is-mobile">
							<Show when={!props.isPlotInit()}>
								<Show when={props.project()?.visibility === Visibility.Public}>
									<div class="level-item">
										<button
											class="button is-fullwidth"
											type="button"
											title={`Share ${props.project()?.name}`}
											onMouseDown={(e) => {
												e.preventDefault();
												setShare(true);
											}}
										>
											<span class="icon">
												<i class="fas fa-share" />
											</span>
											<span>Share</span>
										</button>
									</div>
								</Show>

								<Show when={showPin()}>
									<div class="level-item">
										<button
											class="button is-fullwidth"
											type="button"
											title="Pin this plot"
											onMouseDown={(e) => {
												e.preventDefault();
												setPin(true);
											}}
										>
											<span class="icon">
												<i class="fas fa-thumbtack" />
											</span>
											<span>Pin</span>
										</button>
									</div>
								</Show>
							</Show>
							<div class="level-item">
								<a
									class="button is-fullwidth"
									title={`View ${props.project()?.name} Plots`}
									href={`${resourcePath(props.isConsole)}/${
										props.project()?.slug
									}/plots`}
								>
									<span class="icon">
										<i class="fas fa-th-large" />
									</span>
									<span>Plots</span>
								</a>
							</div>
							<Show when={!props.isPlotInit()}>
								<div class="level-item">
									<button
										class="button is-fullwidth"
										type="button"
										title="Refresh Query"
										onMouseDown={(e) => {
											e.preventDefault();
											props.handleRefresh();
										}}
									>
										<span class="icon">
											<i class="fas fa-sync-alt" />
										</span>
										<span>Refresh</span>
									</button>
								</div>
							</Show>
						</nav>
					</div>
				</nav>
			</div>
		</div>
	);
};

export default PerfHeader;
