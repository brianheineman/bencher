// https://docs.astro.build/en/guides/content-collections/
// 1. Import utilities from `astro:content`
import { defineCollection, z } from "astro:content";

// 2. Define a `type` and `schema` for each collection
const page = defineCollection({
	type: "content", // v2.5.0 and later
	schema: z.object({
		title: z.string(),
		description: z.string(),
		heading: z.string(),
		published: z.string().optional(),
		modified: z.string().optional(),
		sortOrder: z.number(),
		draft: z.boolean().optional(),
		canonicalize: z.boolean().optional(),
	}),
});

const swagger = defineCollection({
	type: "content", // v2.5.0 and later
	schema: z.object({
		title: z.string(),
		description: z.string(),
		heading: z.string(),
		published: z.string().optional(),
		modified: z.string().optional(),
		sortOrder: z.number(),
		draft: z.boolean().optional(),
		canonicalize: z.boolean().optional(),
		paths: z.array(
			z.object({
				path: z.string(),
				method: z.string(),
				headers: z.string(),
				cli: z.string().optional().nullable(),
			}),
		),
	}),
});

// 3. Export a single `collections` object to register your collection(s)
export const collections = {
	// legal
	legal: page,
	// docs
	docs_tutorial: page,
	docs_how_to: page,
	docs_explanation: page,
	docs_reference: page,
	// api
	api_organizations: swagger,
	api_projects: swagger,
	api_users: swagger,
	api_server: swagger,
	// learn
	benchmarking_cpp: page,
	benchmarking_python: page,
	benchmarking_rust: page,
	track_in_ci_cpp: page,
	track_in_ci_python: page,
	track_in_ci_rust: page,
	case_study: page,
	engineering: page,
	// onboard
	onboard: page,
};

export const keywords = ["Continuous Benchmarking"];
