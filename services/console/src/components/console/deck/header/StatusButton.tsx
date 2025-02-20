import * as Sentry from "@sentry/astro";
import {
	type Accessor,
	Match,
	type Resource,
	Switch,
	createSignal,
} from "solid-js";
import { AlertStatus, type JsonAuthUser } from "../../../../types/bencher";
import { httpPatch } from "../../../../util/http";
import { NotifyKind, pageNotify } from "../../../../util/notify";
import { validJwt } from "../../../../util/valid";

export interface Props {
	apiUrl: string;
	user: JsonAuthUser;
	path: Accessor<string>;
	data: Resource<object>;
}

const StatusButton = (props: Props) => {
	const [submitting, setSubmitting] = createSignal(false);

	const getStatus = () => {
		switch (props.data()?.status) {
			case AlertStatus.Active:
				return { status: AlertStatus.Dismissed };
			case AlertStatus.Dismissed:
			case AlertStatus.Silenced:
				return { status: AlertStatus.Active };
			default:
				console.error("Unknown status");
				return;
		}
	};

	const sendStatus = () => {
		// Check the status first, the guarantees that the wasm has been initialized
		const data = getStatus();
		if (!data) {
			return;
		}
		const token = props.user?.token;
		if (!validJwt(token)) {
			return;
		}

		setSubmitting(true);
		const isActive = props.data()?.status === AlertStatus.Active;
		httpPatch(props.apiUrl, props.path(), token, data)
			.then((_resp) => {
				setSubmitting(false);
				// TODO move to global state
				// Reload the entire page to update the alert count in the side bar
				window.location.reload();
			})
			.catch((error) => {
				setSubmitting(false);
				console.error(error);
				Sentry.captureException(error);
				pageNotify(
					NotifyKind.ERROR,
					`Lettuce romaine calm! Failed to ${
						isActive ? "dismiss" : "reactivate"
					} alert: ${error?.response?.data?.message}`,
				);
			});
	};

	return (
		<Switch>
			<Match when={props.data()?.status === AlertStatus.Active}>
				<button
					class="button is-fullwidth"
					type="button"
					title="Dismiss alert"
					disabled={submitting()}
					onMouseDown={(e) => {
						e.preventDefault();
						sendStatus();
					}}
				>
					<span class="icon has-text-primary">
						<i class="far fa-bell" />
					</span>
					<span>Dismiss</span>
				</button>
			</Match>
			<Match
				when={
					props.data()?.status === AlertStatus.Dismissed ||
					props.data()?.status === AlertStatus.Silenced
				}
			>
				<button
					class="button is-fullwidth"
					type="button"
					title="Reactivate alert"
					disabled={submitting()}
					onMouseDown={(e) => {
						e.preventDefault();
						sendStatus();
					}}
				>
					<span class="icon">
						<i class="far fa-bell-slash" />
					</span>
					<span>Reactivate</span>
				</button>
			</Match>
		</Switch>
	);
};
export default StatusButton;
