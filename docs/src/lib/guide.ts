import { type CollectionEntry, getCollection } from "astro:content";

export async function getAllGuides(): Promise<Record<string, CollectionEntry<"guides">[]>> {
  const allGuides: CollectionEntry<"guides">[] = await getCollection("guides");
  const visibleGuides = allGuides.filter(guide => !guide.data.hidden);
  const sortedGuides = visibleGuides.sort((a, b) => a.data.sort - b.data.sort);
  return sortedGuides.reduce((acc: Record<string, CollectionEntry<"guides">[]>, curr: CollectionEntry<"guides">) => {
    const { groupTitle } = curr.data;

    acc[groupTitle] = acc[groupTitle] || [];
    acc[groupTitle].push(curr);

    return acc;
  }, {});
}
