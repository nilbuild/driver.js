import type { APIRoute } from "astro";
import { getSkillMarkdown } from "../../../../lib/agent-skill";

export const GET: APIRoute = async () => {
  return new Response(await getSkillMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
