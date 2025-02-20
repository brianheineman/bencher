import { debounce } from "@solid-primitives/scheduled";
import { type Accessor, Show, createMemo, createSignal } from "solid-js";
import { embedHeight } from "../../../../config/types";
import type {
	JsonAuthUser,
	JsonPerfQuery,
	JsonProject,
} from "../../../../types/bencher";
import { apiUrl } from "../../../../util/http";
import { useSearchParams } from "../../../../util/url";
import { DEBOUNCE_DELAY } from "../../../../util/valid";
import Field from "../../../field/Field";
import FieldKind from "../../../field/kind";
import {
	EMBED_TITLE_PARAM,
	PERF_PLOT_EMBED_PARAMS,
	PERF_PLOT_PARAMS,
} from "../PerfPanel";

export interface Props {
	apiUrl: string;
	isBencherCloud: boolean;
	user: JsonAuthUser;
	perfQuery: Accessor<JsonPerfQuery>;
	isPlotInit: Accessor<boolean>;
	project: Accessor<undefined | JsonProject>;
	share: Accessor<boolean>;
	setShare: (share: boolean) => void;
}

const ShareModal = (props: Props) => {
	const location = window.location;
	const [searchParams, _setSearchParams] = useSearchParams();

	const [title, setTitle] = createSignal(null);

	const handle_title = debounce(
		(_key, value, _valid) => setTitle(value),
		DEBOUNCE_DELAY,
	);

	const perfPlotParams = createMemo(() => {
		const newParams = new URLSearchParams();
		for (const [key, value] of Object.entries(searchParams)) {
			if (value && PERF_PLOT_PARAMS.includes(key)) {
				newParams.set(key, value);
			}
		}

		if (props.isBencherCloud) {
			newParams.set("utm_medium", "share");
			newParams.set("utm_source", "bencher");
			newParams.set("utm_content", "img");
			newParams.set("utm_campaign", "perf+img");
			newParams.set("utm_term", props.project()?.slug ?? "");
		}

		return newParams.toString();
	});

	const perf_page_url = createMemo(
		() =>
			`${location.protocol}//${location.hostname}${
				location.port ? `:${location.port}` : ""
			}/perf/${props.project()?.slug}?${perfPlotParams()}`,
	);

	const perf_img_url = createMemo(() => {
		const project_slug = props.project()?.slug;
		if (
			props.isPlotInit() ||
			!(props.share() && project_slug && props.perfQuery())
		) {
			return null;
		}

		const searchParams = new URLSearchParams();
		for (const [key, value] of Object.entries(props.perfQuery())) {
			if (value) {
				searchParams.set(key, value);
			}
		}
		const img_title = title();
		if (img_title) {
			searchParams.set("title", img_title);
		}
		const url = apiUrl(
			props.apiUrl,
			`/v0/projects/${project_slug}/perf/img?${searchParams.toString()}`,
		);
		return url;
	});

	const perfPlotEmbedParams = createMemo(() => {
		const newParams = new URLSearchParams();
		for (const [key, value] of Object.entries(searchParams)) {
			if (value && PERF_PLOT_EMBED_PARAMS.includes(key)) {
				newParams.set(key, value);
			}
		}
		const img_title = title();
		if (img_title) {
			newParams.set(EMBED_TITLE_PARAM, img_title);
		}

		if (props.isBencherCloud) {
			newParams.set("utm_medium", "share");
			newParams.set("utm_source", "bencher");
			newParams.set("utm_content", "iframe");
			newParams.set("utm_campaign", "perf+embed");
			newParams.set("utm_term", props.project()?.slug ?? "");
		}

		return newParams.toString();
	});

	const perf_embed_url = createMemo(
		() =>
			`${location.protocol}//${location.hostname}${
				location.port ? `:${location.port}` : ""
			}/perf/${props.project()?.slug}/embed?${perfPlotEmbedParams()}`,
	);

	const img_tag = createMemo(
		() =>
			`<a href="${perf_page_url()}"><img src="${perf_img_url()}" title="${
				title() ? title() : props.project()?.name
			}" alt="${title() ? `${title()} for ` : ""}${
				props.project()?.name
			} - Bencher" /></a>`,
	);

	const embed_tag = createMemo(
		() =>
			`<iframe src="${perf_embed_url()}" title="${
				title() ? title() : props.project()?.name
			}" width="100%" height="${embedHeight}px" allow="fullscreen"></iframe>`,
	);

	return (
		<div class={`modal ${props.share() && "is-active"}`}>
			<div
				class="modal-background"
				onMouseDown={(e) => {
					e.preventDefault();
					props.setShare(false);
				}}
			/>
			<div class="modal-card">
				<header class="modal-card-head">
					<p class="modal-card-title">Share {props.project()?.name}</p>
					<button
						class="delete"
						type="button"
						aria-label="close"
						onMouseDown={(e) => {
							e.preventDefault();
							props.setShare(false);
						}}
					/>
				</header>
				<section class="modal-card-body">
					<Field
						kind={FieldKind.INPUT}
						fieldKey="title"
						label="Title (optional)"
						value={title()}
						valid={true}
						config={{
							type: "text",
							placeholder: props.project()?.name,
							icon: "fas fa-chart-line",
							validate: (_input: string) => true,
						}}
						handleField={handle_title}
					/>
					<br />
					<Show when={perf_img_url()} fallback={<div>Loading...</div>}>
						<img src={perf_img_url() ?? ""} alt={props.project()?.name ?? ""} />
					</Show>
					<br />
					<br />
					<h4 class="title is-4">
						Click to Copy <code>img</code> Tag
					</h4>
					{/* biome-ignore lint/a11y/useValidAnchor: Copy tag */}
					<a
						style="word-break: break-all;"
						onMouseDown={(e) => {
							e.preventDefault();
							navigator.clipboard.writeText(img_tag());
						}}
					>
						<code>{img_tag()}</code>
					</a>
					<br />
					<br />
					<blockquote>🐰 Add me to your README!</blockquote>

					<hr />

					<h4 class="title is-4">Embed Perf Plot</h4>
					<h4 class="subtitle is-4">Click to Copy Embed Tag</h4>
					{/* biome-ignore lint/a11y/useValidAnchor: Copy link */}
					<a
						style="word-break: break-all;"
						onMouseDown={(e) => {
							e.preventDefault();
							navigator.clipboard.writeText(embed_tag());
						}}
					>
						{embed_tag()}
					</a>

					<hr />

					<h4 class="title is-4">Click to Copy Public URL</h4>
					{/* biome-ignore lint/a11y/useValidAnchor: Copy link */}
					<a
						style="word-break: break-all;"
						onMouseDown={(e) => {
							e.preventDefault();
							navigator.clipboard.writeText(perf_page_url());
						}}
					>
						{perf_page_url()}
					</a>
				</section>

				<footer class="modal-card-foot">
					<button
						class="button is-primary is-fullwidth"
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							props.setShare(false);
						}}
					>
						Close
					</button>
				</footer>
			</div>
		</div>
	);
};

export default ShareModal;
