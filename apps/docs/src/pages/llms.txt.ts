import type { APIRoute } from "astro";
import { getAgentGuides, SITE_URL } from "../lib/agent-markdown";

const SUMMARY = `# Driver.js

> Lightweight, dependency-free JavaScript library for product tours, element highlights, feature hints and onboarding checklists. Works with any framework.

Install with \`npm install driver.js\`. Each feature is its own entry with its own stylesheet:

- Tours and highlights: \`import { driver } from "driver.js"\` and \`import "driver.js/dist/driver.css"\`
- Hints: \`import { hints } from "driver.js/hints"\` and \`import "driver.js/dist/hints.css"\`
- Checklists: \`import { checklist } from "driver.js/checklist"\` with \`import "driver.js/dist/driver.css"\` and \`import "driver.js/dist/checklist.css"\`

Every page below is Markdown. Drop the \`.md\` suffix for the HTML version.`;

const OPTIONAL_IDS = new Set(["changelog"]);

export const GET: APIRoute = async () => {
  const guides = await getAgentGuides();
  const groups = new Map<string, string[]>();
  const optional = [`- [Full documentation in one file](${SITE_URL}/llms-full.txt)`];

  guides.forEach(({ guide }) => {
    const { title, description, groupTitle, hidden } = guide.data;
    const line = `- [${title}](${SITE_URL}/docs/${guide.id}.md)${description ? `: ${description}` : ""}`;

    if (hidden || OPTIONAL_IDS.has(guide.id)) {
      optional.push(line);
      return;
    }

    groups.set(groupTitle, [...(groups.get(groupTitle) ?? []), line]);
  });

  const sections = [...groups].map(([groupTitle, lines]) => `## ${groupTitle}\n\n${lines.join("\n")}`);
  const body = [SUMMARY, ...sections, `## Optional\n\n${optional.join("\n")}`].join("\n\n");

  return new Response(`${body}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
