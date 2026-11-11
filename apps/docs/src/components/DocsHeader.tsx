import { useState } from "react";
import type { SidebarGroup } from "../lib/guide";

type DocsHeaderProps = {
  groups: SidebarGroup[];
  activeGuideId: string;
};

export function DocsHeader(props: DocsHeaderProps) {
  const { groups, activeGuideId } = props;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-neutral-100 bg-white">
      <div className="flex items-center justify-between px-5 py-3">
        <a href="/" className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em] text-black">
          <img src="/mascot-head.png" alt="driver.js logo" width={900} height={775} className="h-8 w-auto" />
          driver.js
        </a>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="docs-mobile-nav"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setIsOpen(!isOpen)}
          className="-mr-2 rounded-md p-3 hover:bg-neutral-100">
          <img src={isOpen ? "/cross.svg" : "/burger.svg"} alt="" className="h-[14px] w-[14px]" />
        </button>
      </div>
      <nav
        id="docs-mobile-nav"
        aria-label="Documentation"
        className={`${isOpen ? "block" : "hidden"} max-h-[calc(100dvh-57px)] overflow-y-auto px-5 pb-8 pt-2 text-[15px] tracking-[-0.01em]`}>
        {groups.map(group => (
          <div key={group.title} className="docs-sidebar-group -mx-1.5">
            <div className="px-1.5 pb-2 pt-1 text-neutral-400">{group.title}</div>
            <ul>
              {group.guides.map(guide => (
                <li key={guide.id}>
                  <a
                    href={`/docs/${guide.id}`}
                    aria-current={guide.id === activeGuideId ? "page" : undefined}
                    className="inline-flex items-center gap-2 rounded-md px-1.5 py-1.5 leading-[1.2] text-black/60 hover:text-black aria-[current=page]:text-black">
                    {guide.title}
                    {guide.badge && <span className="docs-badge">{guide.badge}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
