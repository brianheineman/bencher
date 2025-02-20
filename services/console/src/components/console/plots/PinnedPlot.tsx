import * as Sentry from "@sentry/astro";
import type { Params } from "astro";
import { createMemo, createResource } from "solid-js";
import type { JsonPlot } from "../../../types/bencher";
import {
	authUser,
	isAllowedProjectDelete,
	isAllowedProjectEdit,
} from "../../../util/auth";
import { httpGet } from "../../../util/http";
import { NotifyKind, navigateNotify } from "../../../util/notify";
import { type InitValid, init_valid, validJwt } from "../../../util/valid";
import Pinned from "./Pinned";

export interface Props {
	isConsole: boolean;
	apiUrl: string;
	params: Params;
}

const PinnedPlot = (props: Props) => {
	const [bencher_valid] = createResource(init_valid);

	const user = authUser();

	const project_slug = createMemo(() => props.params?.project);
	const plotFetcher = createMemo(() => {
		return {
			bencher_valid: bencher_valid(),
			token: user?.token,
		};
	});
	const getPlot = async (fetcher: {
		bencher_valid: InitValid;
		token: string;
	}) => {
		const EMPTY_OBJECT = {};
		if (!fetcher.bencher_valid) {
			return EMPTY_OBJECT;
		}
		if (fetcher.token && !validJwt(fetcher.token)) {
			return EMPTY_OBJECT;
		}
		const path = `/v0/projects/${props.params?.project}/plots/${props.params?.plot}`;
		return await httpGet(props.apiUrl, path, fetcher.token)
			.then((resp) => {
				return resp?.data as JsonPlot;
			})
			.catch((error) => {
				console.error(error);
				Sentry.captureException(error);
				return;
			});
	};
	const [plot, { refetch }] = createResource<JsonPlot>(plotFetcher, getPlot);

	const allowedFetcher = createMemo(() => {
		return {
			apiUrl: props.apiUrl,
			params: props.params,
		};
	});
	const getAllowedEdit = async (fetcher: {
		apiUrl: string;
		params: Params;
	}) => {
		return await isAllowedProjectEdit(fetcher.apiUrl, fetcher.params);
	};
	const [isAllowedEdit] = createResource(allowedFetcher, getAllowedEdit);
	const getAllowedDelete = async (fetcher: {
		apiUrl: string;
		params: Params;
	}) => {
		return await isAllowedProjectDelete(fetcher.apiUrl, fetcher.params);
	};
	const [isAllowedDelete] = createResource(allowedFetcher, getAllowedDelete);

	return (
		<Pinned
			isConsole={props.isConsole}
			apiUrl={props.apiUrl}
			params={props.params}
			user={user}
			project_slug={project_slug}
			isAllowedEdit={isAllowedEdit}
			isAllowedDelete={isAllowedDelete}
			plot={plot()}
			index={() => 0}
			total={() => 1}
			movePlot={() => {}}
			updatePlot={() => {
				refetch();
			}}
			removePlot={() => {
				navigateNotify(
					NotifyKind.OK,
					"Hare today, gone tomorrow. Plot removed!",
					`/console/projects/${props.params?.project}/plots`,
					null,
					null,
				);
			}}
			search={() => props.params?.plot}
		/>
	);
};

export default PinnedPlot;
