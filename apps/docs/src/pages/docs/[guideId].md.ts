import type { APIRoute, GetStaticPaths } from "astro";
import { getAgentGuides } from "../../lib/agent-markdown";

export const getStaticPaths: GetStaticPaths = async () => {
  const guides = await getAgentGuides();

  return guides.map(({ guide, markdown }) => ({
    params: { guideId: guide.id },
    props: { markdown },
  }));
};

export const GET: APIRoute = ({ props }) => {
  return new Response(props.markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
