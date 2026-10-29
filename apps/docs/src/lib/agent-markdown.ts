import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { type CollectionEntry, getCollection } from "astro:content";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

type Guide = CollectionEntry<"guides">;

type MdNode = {
  type: string;
  name?: string | null;
  value?: string;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: MdNode[];
  position?: { start: { offset?: number; column: number }; end: { offset?: number } };
};

type Edit = { start: number; end: number; text: string };

export const SITE_URL = "https://driverjs.com";

const parser = unified().use(remarkParse).use(remarkMdx);

function slice(source: string, node: MdNode) {
  return source.slice(node.position!.start.offset, node.position!.end.offset);
}

function isComponent(node: MdNode) {
  return !!node.name && /^[A-Z]/.test(node.name);
}

function codeBlocksIn(source: string, node: MdNode): string[] {
  return (node.children ?? []).flatMap(child => {
    if (child.type === "code") {
      const indent = new RegExp(`^ {0,${child.position!.start.column - 1}}`, "gm");
      return [slice(source, child).replace(indent, "")];
    }

    return codeBlocksIn(source, child);
  });
}

function stringAttribute(node: MdNode, name: string) {
  const value = node.attributes?.find(attribute => attribute.name === name)?.value;
  return typeof value === "string" ? value : undefined;
}

function expressionAttribute(node: MdNode, name: string) {
  const value = node.attributes?.find(attribute => attribute.name === name)?.value as { value?: string } | undefined;
  return value?.value?.trim();
}

function rawImports(root: MdNode, guide: Guide) {
  const imports = new Map<string, string>();
  const base = dirname(resolve(guide.filePath!));

  root.children
    ?.filter(node => node.type === "mdxjsEsm")
    .forEach(node => {
      for (const match of node.value!.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+)\?raw["']/g)) {
        imports.set(match[1], readFileSync(resolve(base, match[2]), "utf8").trim());
      }
    });

  return imports;
}

function collectEdits(source: string, node: MdNode, imports: Map<string, string>, edits: Edit[]) {
  for (const child of node.children ?? []) {
    const start = child.position!.start.offset!;
    const end = child.position!.end.offset!;

    if (child.type === "mdxjsEsm" || child.type === "mdxFlowExpression" || child.type === "mdxTextExpression") {
      edits.push({ start, end, text: "" });
      continue;
    }

    if (child.type === "mdxJsxFlowElement" && child.name === "Code") {
      const code = imports.get(expressionAttribute(child, "code") ?? "");
      const text = code ? `\`\`\`${stringAttribute(child, "lang") ?? ""}\n${code}\n\`\`\`` : "";
      edits.push({ start, end, text });
      continue;
    }

    if (child.type === "mdxJsxFlowElement") {
      edits.push({ start, end, text: codeBlocksIn(source, child).join("\n\n") });
      continue;
    }

    if (child.type === "mdxJsxTextElement" && isComponent(child)) {
      edits.push({ start, end, text: "" });
      continue;
    }

    if (child.type === "mdxJsxTextElement") {
      continue;
    }

    collectEdits(source, child, imports, edits);
  }
}

function absoluteLinks(markdown: string, guideIds: Set<string>) {
  return markdown.replace(/\]\(\/([^)\s]*)\)/g, (_, path: string) => {
    const [pathname, hash = ""] = path.split("#");
    const guideId = pathname.match(/^docs\/([\w-]+)$/)?.[1];
    if (guideId && guideIds.has(guideId)) {
      return `](${SITE_URL}/docs/${guideId}.md${hash ? `#${hash}` : ""})`;
    }

    return `](${SITE_URL}/${path})`;
  });
}

function assertClean(markdown: string, guide: Guide) {
  const root = parser.parse(markdown) as MdNode;
  const leftovers: string[] = [];
  const walk = (node: MdNode) => {
    if (node.type === "mdxjsEsm" || (node.type.startsWith("mdxJsx") && isComponent(node))) {
      leftovers.push(node.name ?? node.type);
    }

    node.children?.forEach(walk);
  };

  walk(root);
  if (leftovers.length) {
    throw new Error(`Agent markdown for "${guide.id}" still contains MDX: ${leftovers.join(", ")}`);
  }
}

export function guideToMarkdown(guide: Guide, guideIds: Set<string>) {
  const source = guide.body ?? "";
  const root = parser.parse(source) as MdNode;
  const edits: Edit[] = [];

  collectEdits(source, root, rawImports(root, guide), edits);

  const body = edits
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const { title, description } = guide.data;
  const intro = description ? `# ${title}\n\n> ${description}` : `# ${title}`;
  const markdown = `${intro}\n\n${absoluteLinks(body, guideIds)}\n`;

  assertClean(markdown, guide);

  return markdown;
}

export async function getAgentGuides() {
  const guides = await getCollection("guides");
  const guideIds = new Set(guides.map(guide => guide.id));
  const sorted = guides.sort((a, b) => a.data.sort - b.data.sort);

  return sorted.map(guide => ({ guide, markdown: guideToMarkdown(guide, guideIds) }));
}
