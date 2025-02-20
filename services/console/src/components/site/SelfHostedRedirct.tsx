import { Show } from "solid-js";
import type Collection from "../../util/collection";
import { ApiCollections } from "../../util/collection";
import Redirect from "./Redirect";

const SelfHostedRedirect = (props: {
	isBencherCloud: boolean;
	path: string;
	collection?: undefined | Collection;
}) => {
	return (
		<Show
			when={
				!props.isBencherCloud &&
				(props.collection ? !ApiCollections.includes(props.collection) : true)
			}
		>
			<Redirect path={props.path} />
		</Show>
	);
};

export default SelfHostedRedirect;
