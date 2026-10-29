import type { APIRoute } from "astro";
import { SITE_URL } from "../../../lib/agent-markdown";
import { getSkillMarkdown, sha256, SKILL_DESCRIPTION, SKILL_NAME, SKILL_PATH } from "../../../lib/agent-skill";

export const GET: APIRoute = async () => {
  const index = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: SKILL_NAME,
        type: "skill-md",
        description: SKILL_DESCRIPTION,
        url: `${SITE_URL}${SKILL_PATH}`,
        digest: sha256(await getSkillMarkdown()),
      },
    ],
  };

  return new Response(`${JSON.stringify(index, null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
};
