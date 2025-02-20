import type { Params } from "astro";
import FieldKind from "../../components/field/kind";
import {
	isAllowedProjectCreate,
	isAllowedProjectDelete,
	isAllowedProjectEdit,
} from "../../util/auth";
import { ActionButton, Button, Card, Display, Operation, Row } from "../types";
import { addPath, createdUuidPath, parentPath, viewUuidPath } from "../util";
import { PubResourceKind } from "../../components/perf/util";

export const THRESHOLD_ICON = (
	<span class="fa-stack fa-2x" style="font-size: 0.75em;">
		<i class="fas fa-walking fa-stack-1x" />
		<i class="fas fa-ban fa-stack-2x" />
	</span>
);

const paginationUrl = (
	params: undefined | Params,
	dimension: string,
	per_page: number,
	page: number,
	search: undefined | string,
) => {
	const searchParams = new URLSearchParams();
	searchParams.set("per_page", per_page?.toString());
	searchParams.set("page", page?.toString());
	if (search) {
		searchParams.set("search", search.trim());
	}
	const url = `/v0/projects/${
		params?.project
	}/${dimension}?${searchParams.toString()}`;
	return url;
};

const THRESHOLD_FIELDS = {
	branch: {
		name: "branches",
		icon: "fas fa-code-branch",
		option_key: "name",
		value_key: "uuid",
		url: (
			params: undefined | Params,
			per_page: number,
			page: number,
			search: undefined | string,
		) => paginationUrl(params, "branches", per_page, page, search),
	},
	testbed: {
		name: "testbeds",
		icon: "fas fa-server",
		option_key: "name",
		value_key: "uuid",
		url: (
			params: undefined | Params,
			per_page: number,
			page: number,
			search: undefined | string,
		) => paginationUrl(params, "testbeds", per_page, page, search),
	},
	measure: {
		name: "measures",
		icon: "fas fa-shapes",
		option_key: "name",
		value_key: "uuid",
		url: (
			params: undefined | Params,
			per_page: number,
			page: number,
			search: undefined | string,
		) => paginationUrl(params, "measures", per_page, page, search),
	},
};

const thresholdsConfig = {
	[Operation.LIST]: {
		operation: Operation.LIST,
		header: {
			title: (
				<div class="level is-mobile">
					<div class="level-left">
						<div class="level-item">
							{THRESHOLD_ICON}
							&nbsp;Thresholds
						</div>
					</div>
				</div>
			),
			name: "Thresholds",
			buttons: [
				{ kind: Button.ARCHIVED },
				{
					kind: Button.ADD,
					title: "Threshold",
					path: addPath,
					is_allowed: isAllowedProjectCreate,
				},
				{ kind: Button.REFRESH },
			],
		},
		table: {
			url: (params: Params) => `/v0/projects/${params?.project}/thresholds`,
			add: {
				prefix: (
					<div>
						<h4>🐰 Create your first threshold!</h4>
						<p>
							It's easy to create a new threshold.
							<br />
							<a href="/docs/explanation/thresholds/">Learn about thresholds</a>{" "}
							or tap below to get started.
						</p>
					</div>
				),
				path: addPath,
				text: "Add a Threshold",
			},
			row: {
				kind: Row.THRESHOLD,
				button: {
					text: "View",
					path: viewUuidPath,
				},
			},
			name: "thresholds",
		},
	},
	[Operation.ADD]: {
		operation: Operation.ADD,
		header: {
			title: "Add Threshold",
			path: parentPath,
			path_to: "Thresholds",
		},
		form: {
			url: (params: Params) => `/v0/projects/${params?.project}/thresholds`,
			fields: [
				{
					kind: FieldKind.RADIO,
					label: "Branch",
					key: "branch",
					value: "",
					valid: null,
					validate: true,
					config: THRESHOLD_FIELDS.branch,
				},
				{
					kind: FieldKind.RADIO,
					label: "Testbed",
					key: "testbed",
					value: "",
					valid: null,
					validate: true,
					config: THRESHOLD_FIELDS.testbed,
				},
				{
					kind: FieldKind.RADIO,
					label: "Measure",
					key: "measure",
					value: "",
					valid: null,
					validate: true,
					config: THRESHOLD_FIELDS.measure,
				},
				{
					kind: FieldKind.MODEL,
					label: null,
					key: "model",
					value: {},
					validate: true,
					config: null,
				},
			],
			path: createdUuidPath,
		},
	},
	[Operation.VIEW]: {
		operation: Operation.VIEW,
		header: {
			keys: [
				["branch", "name"],
				["testbed", "name"],
				["measure", "name"],
			],
			path: parentPath,
			path_to: "Thresholds",
			buttons: [
				{
					kind: Button.EDIT,
					path: (pathname: string) => `${pathname}/edit`,
					is_allowed: isAllowedProjectEdit,
				},
				{ kind: Button.REFRESH },
			],
		},
		deck: {
			url: (params: Params, search: Params) =>
				`/v0/projects/${params?.project}/thresholds/${params?.threshold}${
					search?.model ? `?model=${search?.model}` : ""
				}`,
			top_buttons: [
				{
					kind: ActionButton.ARCHIVED,
					resource: PubResourceKind.Threshold,
				},
				{
					kind: ActionButton.REMOVE_MODEL,
				},
				{
					kind: ActionButton.MODEL_REPLACED,
				},
			],
			cards: [
				{
					kind: Card.FIELD,
					label: "Threshold UUID",
					key: "uuid",
					display: Display.RAW,
				},
				{
					kind: Card.FIELD,
					label: "Branch",
					key: "branch",
					display: Display.BRANCH,
				},
				{
					kind: Card.FIELD,
					label: "Testbed",
					key: "testbed",
					display: Display.TESTBED,
				},
				{
					kind: Card.FIELD,
					label: "Measure",
					key: "measure",
					display: Display.MEASURE,
				},
				{
					kind: Card.NESTED_FIELD,
					label: "Threshold Model Test",
					keys: ["model", "test"],
					display: Display.MODEL_TEST,
				},
				{
					kind: Card.NESTED_FIELD,
					label: "Lower Boundary",
					keys: ["model", "lower_boundary"],
					display: Display.RAW,
				},
				{
					kind: Card.NESTED_FIELD,
					label: "Upper Boundary",
					keys: ["model", "upper_boundary"],
					display: Display.RAW,
				},
				{
					kind: Card.NESTED_FIELD,
					label: "Minimum Sample Size",
					keys: ["model", "min_sample_size"],
					display: Display.RAW,
				},
				{
					kind: Card.NESTED_FIELD,
					label: "Maximum Sample Size",
					keys: ["model", "max_sample_size"],
					display: Display.RAW,
				},
				{
					kind: Card.NESTED_FIELD,
					label: "Window Size (seconds)",
					keys: ["model", "window"],
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
						"⚠️ All Reports that use this Threshold must be deleted first! ⚠️",
					path: parentPath,
					is_allowed: isAllowedProjectDelete,
				},
			],
		},
	},
	[Operation.EDIT]: {
		operation: Operation.EDIT,
		header: {
			title: "Edit Threshold Model",
			path: parentPath,
			path_to: "Threshold",
		},
		form: {
			url: (params: Params) =>
				`/v0/projects/${params?.project}/thresholds/${params?.threshold}`,
			fields: [
				{
					kind: FieldKind.MODEL,
					label: null,
					key: "model",
					value: {},
					validate: true,
					config: null,
				},
			],
			path: parentPath,
		},
	},
};

export default thresholdsConfig;
