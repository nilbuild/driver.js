import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: changelog-release.mjs <version>");
  process.exit(1);
}

const file = new URL(
  "../docs/src/content/guides/changelog.mdx",
  import.meta.url,
);
const content = readFileSync(file, "utf8");

const heading = "## Unreleased";
const headingIndex = content.indexOf(heading);
if (headingIndex === -1) {
  console.error('No "## Unreleased" heading found in changelog.');
  process.exit(1);
}

const afterHeading = headingIndex + heading.length;
const nextHeadingIndex = content.indexOf("\n## ", afterHeading);
const section = content.slice(
  afterHeading,
  nextHeadingIndex === -1 ? undefined : nextHeadingIndex,
);

if (section.trim() === "") {
  console.error("The Unreleased section is empty — nothing to release.");
  process.exit(1);
}

const updated =
  content.slice(0, afterHeading) +
  `\n\n## ${version}` +
  content.slice(afterHeading);

writeFileSync(file, updated);
console.log(`changelog: moved Unreleased entries under ${version}`);
