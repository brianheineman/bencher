import * as Sentry from "@sentry/astro";
import { type Accessor, type Resource, Show, createSignal } from "solid-js";
import type { JsonAuthUser } from "../../../../types/bencher";
import { fmtDate } from "../../../../util/convert";
import { httpPatch } from "../../../../util/http";
import { NotifyKind, pageNotify } from "../../../../util/notify";
import { validJwt } from "../../../../util/valid";

export interface Props {
	apiUrl: string;
	user: JsonAuthUser;
	path: Accessor<string>;
	data: Resource<object>;
	subtitle: string;
	redirect: (pathname: string, data: object) => string;
	notify?: boolean;
	effect?: undefined | (() => void);
	isAllowed: Resource<boolean>;
	handleRefresh: () => void;
}

const ArchiveButton = (props: Props) => {
	const [archiving, setArchiving] = createSignal(false);

	const sendArchive = () => {
		setArchiving(true);
		const data = props.data();
		// This guarantees that the wasm has been loaded
		if (!data) {
			setArchiving(false);
			return;
		}

		const token = props.user?.token;
		if (!validJwt(token)) {
			setArchiving(false);
			return;
		}

		httpPatch(props.apiUrl, props.path(), token, { archived: !data.archived })
			.then((_resp) => {
				setArchiving(false);
				props.handleRefresh();
			})
			.catch((error) => {
				setArchiving(false);
				console.error(error);
				Sentry.captureException(error);
				pageNotify(
					NotifyKind.ERROR,
					`Lettuce romaine calm! Failed to archive: ${error?.response?.data?.message}`,
				);
			});
	};

	return (
		<Show
			when={props.data()?.archived}
			fallback={
				<Show when={props.isAllowed()}>
					<div class="buttons is-right">
						<button
							class="button is-small"
							type="button"
							disabled={archiving()}
							onMouseDown={(e) => {
								e.preventDefault();
								sendArchive();
							}}
						>
							<span class="icon">
								<i class="fas fa-archive" />
							</span>
							<span>Archive</span>
						</button>
					</div>
				</Show>
			}
		>
			<div class="notification is-warning">
				<div class="columns is-vcentered">
					<div class="column">
						<p>
							This {props.subtitle} was archived on{" "}
							{fmtDate(props.data()?.archived)}
						</p>
					</div>
					<Show when={props.isAllowed()}>
						<div class="column is-narrow">
							<button
								type="button"
								class="button is-small"
								disabled={archiving()}
								onMouseDown={(e) => {
									e.preventDefault();
									sendArchive();
								}}
							>
								<span class="icon">
									<i class="fas fa-archive" />
								</span>
								<span>Unarchive</span>
							</button>
						</div>
					</Show>
				</div>
			</div>
		</Show>
	);
};

export default ArchiveButton;
