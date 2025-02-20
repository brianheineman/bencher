import type { Params } from "astro";
import { validBenchmarkName, validSlug } from "../../util/valid";
import { ActionButton, Button, Card, Display, Operation } from "../types";
import { addPath, createdSlugPath, parentPath, viewSlugPath } from "../util";
import type { JsonBenchmark } from "../../types/bencher";
import FieldKind from "../../components/field/kind";
import {
	isAllowedProjectCreate,
	isAllowedProjectDelete,
	isAllowedProjectEdit,
} from "../../util/auth";
import IconTitle from "../../components/site/IconTitle";

export const BENCHMARK_ICON = "fas fa-tachometer-alt";

const BENCHMARK_FIELDS = {
	name: {
		type: "text",
		placeholder: "Benchmark Name",
		icon: BENCHMARK_ICON,
		help: "Must be a non-empty string",
		validate: validBenchmarkName,
	},
	slug: {
		type: "text",
		placeholder: "Benchmark Slug",
		icon: "fas fa-exclamation-triangle",
		help: "Must be a valid slug",
		validate: validSlug,
	},
};

const benchmarksConfig = {
	[Operation.LIST]: {
		operation: Operation.LIST,
		header: {
			title: <IconTitle icon={BENCHMARK_ICON} title="Benchmarks" />,
			name: "Benchmarks",
			buttons: [
				{ kind: Button.SEARCH },
				{ kind: Button.ARCHIVED },
				{
					kind: Button.ADD,
					title: "Benchmark",
					path: addPath,
					is_allowed: isAllowedProjectCreate,
				},
				{ kind: Button.REFRESH },
			],
		},
		table: {
			url: (params: Params) => `/v0/projects/${params?.project}/benchmarks`,
			add: {
				prefix: (
					<div>
						<h4>🐰 No benchmarks yet...</h4>
						<p>
							It's easy to track your benchmarks.
							<br />
							Tap below to learn how.
						</p>
					</div>
				),
				path: (_pathname: string) => {
					return "https://bencher.dev/docs/how-to/track-benchmarks";
				},
				text: "Track Your Benchmarks",
			},
			row: {
				key: "name",
				items: [{}, {}, {}, {}],
				button: {
					text: "View",
					path: viewSlugPath,
				},
			},
			name: "benchmarks",
		},
	},
	[Operation.ADD]: {
		operation: Operation.ADD,
		header: {
			title: "Add Benchmark",
			path: parentPath,
			path_to: "Benchmarks",
		},
		form: {
			url: (params: Params) => `/v0/projects/${params?.project}/benchmarks`,
			fields: [
				{
					kind: FieldKind.INPUT,
					label: "Name",
					key: "name",
					value: "",
					valid: null,
					validate: true,
					config: BENCHMARK_FIELDS.name,
				},
			],
			path: createdSlugPath,
		},
	},
	[Operation.VIEW]: {
		operation: Operation.VIEW,
		header: {
			key: "name",
			path: parentPath,
			path_to: "Benchmarks",
			buttons: [{ kind: Button.REFRESH }],
		},
		deck: {
			url: (params: Params) =>
				`/v0/projects/${params?.project}/benchmarks/${params?.benchmark}`,
			top_buttons: [
				{
					kind: ActionButton.ARCHIVE,
					subtitle: "Benchmark",
					path: parentPath,
					is_allowed: isAllowedProjectEdit,
				},
			],
			cards: [
				{
					kind: Card.FIELD,
					label: "Benchmark Name",
					key: "name",
					display: Display.RAW,
					is_allowed: isAllowedProjectEdit,
					field: {
						kind: FieldKind.INPUT,
						label: "Name",
						key: "name",
						value: "",
						valid: null,
						validate: true,
						config: BENCHMARK_FIELDS.name,
					},
				},
				{
					kind: Card.FIELD,
					label: "Benchmark Slug",
					key: "slug",
					display: Display.RAW,
					is_allowed: isAllowedProjectEdit,
					field: {
						kind: FieldKind.INPUT,
						label: "Slug",
						key: "slug",
						value: "",
						valid: null,
						validate: true,
						config: BENCHMARK_FIELDS.slug,
					},
					path: (params: Params, data: JsonBenchmark) =>
						`/console/projects/${params.project}/benchmarks/${data.slug}`,
				},
				{
					kind: Card.FIELD,
					label: "Benchmark UUID",
					key: "uuid",
					display: Display.RAW,
				},
			],
			buttons: [
				{
					kind: ActionButton.RAW,
				},
				{
					kind: ActionButton.DELETE,
					subtitle:
						"⚠️ All Reports that use this Benchmark must be deleted first! ⚠️",
					path: parentPath,
					is_allowed: isAllowedProjectDelete,
				},
			],
		},
	},
};

export default benchmarksConfig;
