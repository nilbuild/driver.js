import { createHash } from "node:crypto";
import { getAgentGuides, SITE_URL } from "./agent-markdown";

export const SKILL_NAME = "driver-js";
export const SKILL_PATH = `/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`;
export const SKILL_DESCRIPTION =
  "Add product tours, element highlights, feature hints and onboarding checklists to a web app with Driver.js.";

export async function getSkillMarkdown() {
  const guides = await getAgentGuides();
  const pages = guides
    .filter(({ guide }) => !guide.data.hidden && guide.id !== "changelog")
    .map(({ guide }) => {
      const { title, description } = guide.data;
      return `- [${title}](${SITE_URL}/docs/${guide.id}.md)${description ? `: ${description}` : ""}`;
    });

  return `---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION} Use when the user wants an onboarding tour, a guided walkthrough, a spotlight on an element, pulsing hint beacons or a getting-started checklist.
---

# Driver.js

Driver.js is a lightweight, dependency-free JavaScript library. It works with any framework.

## Install

\`\`\`bash
npm install driver.js
\`\`\`

Each feature is its own entry with its own stylesheet:

- Tours and highlights: \`import { driver } from "driver.js"\` and \`import "driver.js/dist/driver.css"\`
- Hints: \`import { hints } from "driver.js/hints"\` and \`import "driver.js/dist/hints.css"\`
- Checklists: \`import { checklist } from "driver.js/checklist"\` with \`import "driver.js/dist/driver.css"\` and \`import "driver.js/dist/checklist.css"\`

## Tour

\`\`\`js
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const driverObj = driver({
  showProgress: true,
  steps: [
    { element: "#new-project", popover: { title: "New project", description: "Start here." } },
    { element: "#settings", popover: { title: "Settings", description: "Configure your workspace." } },
  ],
});

driverObj.drive();
\`\`\`

## Highlight one element

\`\`\`js
const driverObj = driver();
driverObj.highlight({ element: "#search", popover: { title: "Search", description: "Find anything." } });
\`\`\`

## Workflow

1. Read the page for the feature you need from the list below before writing code. Every page is Markdown.
2. Use the exact option names from the [configuration](${SITE_URL}/docs/configuration.md) and [API](${SITE_URL}/docs/api.md) pages.
3. Import the stylesheet for each entry you use.

## Docs

${pages.join("\n")}

The whole documentation in one file: ${SITE_URL}/llms-full.txt
`;
}

export function sha256(text: string) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
