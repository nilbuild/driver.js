import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const guides = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/guides" }),
  schema: z.object({
    groupTitle: z.string(),
    title: z.string(),
    sort: z.number(),
    description: z.string().optional(),
  }),
});

export const collections = { guides };
