import type { Example, ExampleGroup } from "./types";
import { highlightGroup } from "./highlight";
import { popoverGroup } from "./popover";
import { tourGroup } from "./tour";
import { apiGroup } from "./api";

export const exampleGroups: ExampleGroup[] = [highlightGroup, popoverGroup, tourGroup, apiGroup];

export const examples: Example[] = exampleGroups.flatMap(group => group.examples);

export function findExample(id: string | undefined): Example | undefined {
  return examples.find(example => example.id === id);
}

export type { Example, ExampleGroup };
