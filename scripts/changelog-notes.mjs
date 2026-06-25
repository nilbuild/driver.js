import { readFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  process.exit(0);
}

const file = new URL(
  "../docs/src/content/guides/changelog.mdx",
  import.meta.url,
);
const content = readFileSync(file, "utf8");

const heading = `## ${version}`;
const headingIndex = content.indexOf(heading);
if (headingIndex === -1) {
  process.exit(0);
}

const afterHeading = headingIndex + heading.length;
const nextHeadingIndex = content.indexOf("\n## ", afterHeading);
const section = content.slice(
  afterHeading,
  nextHeadingIndex === -1 ? undefined : nextHeadingIndex,
);

process.stdout.write(section.trim());
