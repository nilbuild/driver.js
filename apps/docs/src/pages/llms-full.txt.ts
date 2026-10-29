import type { APIRoute } from "astro";
import { getAgentGuides } from "../lib/agent-markdown";

export const GET: APIRoute = async () => {
  const guides = await getAgentGuides();
  const body = guides
    .filter(({ guide }) => guide.id !== "changelog")
    .map(({ markdown }) => markdown.trim())
    .join("\n\n---\n\n");

  return new Response(`${body}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
