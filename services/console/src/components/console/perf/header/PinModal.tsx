import * as Sentry from "@sentry/astro";
import { type Accessor, createResource, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { PLOT_FIELDS } from "../../../../config/project/plot";
import type {
	JsonAuthUser,
	JsonNewPlot,
	JsonPerfQuery,
	JsonProject,
	XAxis,
} from "../../../../types/bencher";
import { httpPost } from "../../../../util/http";
import { NotifyKind, pageNotify } from "../../../../util/notify";
import { useNavigate } from "../../../../util/url";
import { init_valid } from "../../../../util/valid";
import Field, { type FieldHandler } from "../../../field/Field";
import FieldKind from "../../../field/kind";

export interface Props {
	apiUrl: string;
	user: JsonAuthUser;
	project: Accessor<undefined | JsonProject>;
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
	pin: Accessor<boolean>;
	setPin: (share: boolean) => void;
}

const PinModal = (props: Props) => {
	const [bencher_valid] = createResource(init_valid);
	const navigate = useNavigate();

	const [form, setForm] = createStore(initForm());
	const [submitting, setSubmitting] = createSignal(false);
	const [valid, setValid] = createSignal(true);

	const isSendable = (): boolean => {
		return !submitting() && valid();
	};

	const handleField: FieldHandler = (key, value, valid) => {
		setForm({
			...form,
			[key]: {
				value,
				valid,
			},
		});

		setValid(validateForm());
	};

	const validateForm = () =>
		(form?.window?.valid && form?.index?.valid) ?? false;

	const handleSubmit = () => {
		if (!bencher_valid()) {
			return;
		}
		// This should never be possible, but just double check.
		if (props.isPlotInit()) {
			return;
		}

		setSubmitting(true);

		const newPlot: JsonNewPlot = {
			index: Number.parseInt(form?.index?.value - 1),
			title: form?.title?.value ? form?.title?.value?.trim() : undefined,
			lower_value: props.lower_value(),
			upper_value: props.upper_value(),
			lower_boundary: props.lower_boundary(),
			upper_boundary: props.upper_boundary(),
			x_axis: props.x_axis(),
			window: Number.parseInt(form?.window?.value),
			branches: props.branches(),
			testbeds: props.testbeds(),
			benchmarks: props.benchmarks(),
			measures: props.measures(),
		};

		httpPost(
			props.apiUrl,
			`/v0/projects/${props.project()?.uuid}/plots`,
			props.user?.token,
			newPlot,
		)
			.then((resp) => {
				setSubmitting(false);
				navigate(
					`/console/projects/${props.project()?.slug}/plots#${
						resp?.data?.uuid
					}`,
				);
			})
			.catch((error) => {
				setSubmitting(false);
				console.error(error);
				Sentry.captureException(error);
				pageNotify(
					NotifyKind.ERROR,
					`Failed to save plot: ${error?.response?.data?.message}`,
				);
			});
	};

	return (
		<form
			class={`modal ${props.pin() && "is-active"}`}
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<div
				class="modal-background"
				onMouseDown={(e) => {
					e.preventDefault();
					props.setPin(false);
				}}
				onKeyDown={(e) => {
					e.preventDefault();
					props.setPin(false);
				}}
			/>
			<div class="modal-card">
				<header class="modal-card-head">
					<p class="modal-card-title">Pin this plot</p>
					<button
						class="delete"
						type="button"
						aria-label="close"
						onMouseDown={(e) => {
							e.preventDefault();
							props.setPin(false);
						}}
					/>
				</header>
				<section class="modal-card-body">
					<Field
						kind={FieldKind.INPUT}
						fieldKey="title"
						label={
							<>
								Title <small>(optional)</small>
							</>
						}
						value={form?.title?.value}
						valid={form?.title?.valid}
						config={PLOT_FIELDS.title}
						handleField={handleField}
					/>
					<hr />
					<Field
						kind={FieldKind.PLOT_WINDOW}
						fieldKey="window"
						label={
							<>
								Time Window <small>(seconds)</small>
							</>
						}
						value={form?.window?.value}
						valid={form?.window?.valid}
						config={{
							help: PLOT_FIELDS.window.help,
						}}
						handleField={handleField}
					/>
					<hr />
					<Field
						kind={FieldKind.PLOT_RANK}
						fieldKey="index"
						label="Insert Location"
						value={form?.index?.value}
						valid={form?.index?.valid}
						config={{
							bottom: "Insert at bottom",
							top: "Insert at top",
							help: PLOT_FIELDS.index.help,
						}}
						handleField={handleField}
					/>
				</section>

				<footer class="modal-card-foot">
					<button
						class="button is-primary is-fullwidth"
						type="button"
						disabled={!isSendable()}
						onMouseDown={(e) => {
							e.preventDefault();
							handleSubmit();
						}}
					>
						Pin
					</button>
				</footer>
			</div>
		</form>
	);
};

const initForm = () => {
	return {
		title: {
			value: "",
			valid: null,
		},
		window: {
			value: 2419200,
			valid: true,
		},
		index: {
			value: 1,
			valid: true,
		},
	};
};

export default PinModal;
