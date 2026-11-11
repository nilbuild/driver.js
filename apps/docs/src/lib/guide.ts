import { type CollectionEntry, getCollection } from "astro:content";

const GROUP_ORDER = ["Introduction", "Tours", "Hints & Checklists", "Recipes", "Reference"];

export type SidebarGuide = {
  id: string;
  title: string;
  badge?: string;
};

export type SidebarGroup = {
  title: string;
  guides: SidebarGuide[];
};

function isInSidebar(guide: CollectionEntry<"guides">) {
  return !guide.data.hidden && guide.data.sidebar !== false;
}

function groupRank(title: string) {
  const index = GROUP_ORDER.indexOf(title);
  if (index === -1) {
    return GROUP_ORDER.length;
  }

  return index;
}

export async function getSidebarGroups(): Promise<SidebarGroup[]> {
  const allGuides = await getCollection("guides");
  const sortedGuides = allGuides.filter(isInSidebar).sort((a, b) => a.data.sort - b.data.sort);

  const groups: SidebarGroup[] = [];
  for (const guide of sortedGuides) {
    let group = groups.find(item => item.title === guide.data.groupTitle);
    if (!group) {
      group = { title: guide.data.groupTitle, guides: [] };
      groups.push(group);
    }

    group.guides.push({ id: guide.id, title: guide.data.title, badge: guide.data.badge });
  }

  return groups.sort((a, b) => groupRank(a.title) - groupRank(b.title));
}
