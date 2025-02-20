import type { Params } from "astro";
import type { JsonProject } from "../../types/bencher";
import PerfPanel from "../console/perf/PerfPanel";

export interface Props {
	apiUrl: string;
	isBencherCloud: boolean;
	params: Params;
	project: undefined | JsonProject;
}

const PublicProject = (props: Props) => {
	return (
		<section class="section">
			<div class="container">
				<div class="columns">
					<div class="column">
						<PerfPanel
							apiUrl={props.apiUrl}
							isBencherCloud={props.isBencherCloud}
							params={props.params}
							project={props.project}
						/>
					</div>
				</div>
			</div>
		</section>
	);
};

export default PublicProject;
