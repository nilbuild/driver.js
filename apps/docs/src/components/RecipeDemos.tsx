import { useEffect, useRef, useState } from "react";
import type { Driver, DriveStep } from "driver.js";
import { driver } from "driver.js";
import { navigate } from "astro:transitions/client";
import type { DriverHint, Hints } from "driver.js/hints";
import { hints } from "driver.js/hints";
import type { Checklist, ChecklistConfig } from "driver.js/checklist";
import { checklist } from "driver.js/checklist";
import "driver.js/dist/driver.css";
import "driver.js/dist/hints.css";
import "driver.js/dist/checklist.css";
import { box, type DemoProps, Frame, primary, secondary, useTour } from "./ActionDrivenSample";

const logBox = "max-h-40 overflow-y-auto rounded-md bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700";

function readJson<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved === null ? fallback : (JSON.parse(saved) as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function useLog(): [string[], (line: string) => void, () => void] {
  const [lines, setLines] = useState<string[]>([]);

  function add(line: string) {
    setLines(current => [...current, line]);
  }

  return [lines, add, () => setLines([])];
}

function Log(props: { id: string; lines: string[]; empty: string }) {
  return (
    <ol id={props.id} className={logBox}>
      {props.lines.length === 0 && <li className="text-gray-400">{props.empty}</li>}
      {props.lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ol>
  );
}

function Toolbar(props: { prefix: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button id={`${props.prefix}-search`} type="button" className={secondary}>
        Search
      </button>
      <button id={`${props.prefix}-filters`} type="button" className={secondary}>
        Filters
      </button>
      <button id={`${props.prefix}-export`} type="button" className={secondary}>
        Export
      </button>
    </div>
  );
}

function toolbarSteps(prefix: string): DriveStep[] {
  return [
    {
      element: `#${prefix}-search`,
      popover: { title: "Search", description: "Find any order.", side: "bottom", align: "start" },
    },
    {
      element: `#${prefix}-filters`,
      popover: { title: "Filters", description: "Narrow the list down.", side: "bottom", align: "start" },
    },
    {
      element: `#${prefix}-export`,
      popover: { title: "Export", description: "Download it as CSV.", side: "bottom", align: "start" },
    },
  ];
}

export function AnalyticsDemo(props: DemoProps) {
  const [lines, track, clear] = useLog();
  const start = useTour();

  function onStart() {
    clear();
    start({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      steps: toolbarSteps("ta"),
      onHighlighted: (element, step, opts) => {
        track(`tour_step_viewed  { step: ${(opts.index ?? 0) + 1} }`);
      },
      onDestroyed: (element, step, opts) => {
        track(`tour_ended  { reason: "${opts.reason}", step: ${(opts.index ?? 0) + 1} }`);
      },
    });
  }

  const ui = (
    <div className={box}>
      <Toolbar prefix="ta" />
      <Log id="ta-log" lines={lines} empty="Events show up here." />
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

export function LoadOnNextDemo(props: DemoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const start = useTour();

  function loadReport() {
    return new Promise<void>(resolve => {
      window.setTimeout(() => {
        setIsLoaded(true);
        window.setTimeout(resolve, 50);
      }, 1200);
    });
  }

  function onStart() {
    setIsLoaded(false);
    start({
      showButtons: ["next", "previous", "close"],
      steps: [
        {
          element: "#ln-reports",
          popover: {
            title: "Your weekly report",
            description: "Next loads the report first.",
            side: "bottom",
            align: "start",
            onNextClick: async (element, step, opts) => {
              opts.driver.updatePopover({ nextBtnText: "Loading…", disableButtons: ["next"] });
              await loadReport();
              opts.driver.moveNext();
            },
          },
        },
        {
          element: "#ln-report",
          onDeselected: () => setIsLoaded(false),
          popover: {
            title: "Here it is",
            description: "It loaded before this step showed. Previous unloads it again.",
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <span id="ln-reports" className="w-fit text-lg font-semibold">
        Reports
      </span>
      {isLoaded ? (
        <span id="ln-report" className="w-fit text-sm text-green-700">
          Revenue is up 12% this week
        </span>
      ) : (
        <span className="text-sm text-gray-500">Not loaded yet.</span>
      )}
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

type RememberedHintsProps = DemoProps & {
  storageKey: string;
};

export function RememberedHintsDemo(props: RememberedHintsProps) {
  const instance = useRef<Hints | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [isShown, setIsShown] = useState(false);
  const prefix = props.storageKey;

  useEffect(() => {
    setDismissed(readJson<string[]>(prefix, []));
    return () => instance.current?.hide();
  }, [prefix]);

  const allHints: DriverHint[] = [
    {
      id: "export-pdf",
      element: `#${prefix}-export`,
      popover: { title: "New: export to PDF", description: "Download any report as a PDF." },
    },
    {
      id: "share",
      element: `#${prefix}-share`,
      popover: { title: "New: share a link", description: "Anyone with the link can view." },
    },
  ];

  function onLoadPage() {
    instance.current?.hide();
    const saved = readJson<string[]>(prefix, []);
    instance.current = hints({
      hints: allHints.filter(hint => !saved.includes(hint.id!)),
      onDismiss: (element, hint) => {
        const next = [...readJson<string[]>(prefix, []), hint.id!];
        writeJson(prefix, next);
        setDismissed(next);
      },
    });
    instance.current.show();
    setIsShown(true);
  }

  function forget() {
    writeJson(prefix, undefined);
    setDismissed([]);
    onLoadPage();
  }

  const ui = (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-semibold">Q3 report</span>
        <span className="flex gap-2">
          <button id={`${prefix}-export`} type="button" className={secondary}>
            Export PDF
          </button>
          <button id={`${prefix}-share`} type="button" className={secondary}>
            Share
          </button>
        </span>
      </div>
      <span className="text-sm text-gray-500">
        {isShown ? "Open a beacon and press Got it, then load the page again. " : ""}
        Dismissed: {dismissed.length ? dismissed.join(", ") : "none"}
      </span>
      {dismissed.length > 0 && (
        <button type="button" onClick={forget} className="w-fit cursor-pointer text-sm underline">
          Forget dismissals
        </button>
      )}
    </div>
  );

  return <Frame ui={ui} code={props.code} buttonText="Load the Page" onStart={onLoadPage} />;
}

export function HintTourDemo(props: DemoProps) {
  const instance = useRef<Hints | null>(null);
  const tour = useRef<Driver | null>(null);
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    return () => {
      tour.current?.destroy();
      instance.current?.hide();
    };
  }, []);

  function onToggle() {
    if (isShown) {
      instance.current?.hide();
      setIsShown(false);
      return;
    }

    tour.current = driver({
      animate: true,
      showProgress: true,
      steps: [
        {
          element: "#ht-chart",
          popover: { title: "Your numbers", description: "Updated every hour.", side: "bottom", align: "start" },
        },
        {
          element: "#ht-whats-new",
          popover: {
            title: "Back to the hints",
            description: "The beacon comes back once the tour ends.",
            side: "bottom",
            align: "end",
          },
        },
      ],
    });
    instance.current =
      instance.current ??
      hints({
        hints: [
          {
            id: "whats-new",
            element: "#ht-whats-new",
            popover: {
              title: "New dashboard",
              description: "Want a quick walkthrough?",
              buttonText: "Take the tour",
              onButtonClick: (element, hint, opts) => {
                opts.hints.close();
                tour.current?.drive();
              },
            },
          },
        ],
      });
    instance.current.show();
    setIsShown(true);
  }

  const ui = (
    <div className={box}>
      <div className="flex items-center justify-between">
        <span id="ht-chart" className="text-lg font-semibold">
          1,204 visits
        </span>
        <button id="ht-whats-new" type="button" className={secondary}>
          What&apos;s new
        </button>
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} buttonText={isShown ? "Hide Hints" : "Show Hints"} onStart={onToggle} />;
}

const labels = {
  en: { next: "Next", prev: "Back", done: "Done", of: "of", close: "Close tour" },
  de: { next: "Weiter", prev: "Zurück", done: "Fertig", of: "von", close: "Tour schließen" },
};

type Language = keyof typeof labels;

export function TranslateDemo(props: DemoProps) {
  const [lang, setLang] = useState<Language>("de");
  const start = useTour();

  function onStart() {
    const t = labels[lang];
    start({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: `${t.next} &rarr;`,
      prevBtnText: `&larr; ${t.prev}`,
      doneBtnText: t.done,
      progressText: `{{current}} ${t.of} {{total}}`,
      closeBtnLabel: t.close,
      steps: toolbarSteps("tr"),
    });
  }

  const ui = (
    <div className={box}>
      <Toolbar prefix="tr" />
      <div className="flex gap-4 text-sm">
        {(Object.keys(labels) as Language[]).map(item => (
          <label key={item} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="tr-lang" checked={lang === item} onChange={() => setLang(item)} />
            {item}
          </label>
        ))}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

let hideActiveChecklist: (() => void) | undefined;

function useChecklist(create: () => ChecklistConfig) {
  const instance = useRef<Checklist | null>(null);
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    return () => instance.current?.hide();
  }, []);

  function hide() {
    instance.current?.hide();
    setIsShown(false);
  }

  function toggle() {
    if (isShown) {
      hide();
      return;
    }

    hideActiveChecklist?.();
    hideActiveChecklist = hide;
    instance.current = instance.current ?? checklist(create());
    instance.current.show();
    instance.current.open();
    setIsShown(true);
  }

  return { instance, isShown, toggle };
}

const SAVED_KEY = "driver-docs-checklist-saved";

export function SavedChecklistDemo(props: DemoProps) {
  const list = useChecklist(() => ({
    id: "docs-saved",
    title: "Get started",
    allowManualComplete: true,
    items: [
      { id: "profile", title: "Fill in your profile" },
      { id: "video", title: "Watch the intro video" },
      { id: "invite", title: "Invite a teammate" },
    ],
    completed: readJson<string[]>(SAVED_KEY, []),
    onProgress: progress => writeJson(SAVED_KEY, progress.completed),
  }));

  function reset() {
    writeJson(SAVED_KEY, undefined);
    list.instance.current?.reset();
  }

  const ui = (
    <div className={box}>
      <span className="text-sm text-gray-500">
        Tick an item, reload the page, and open the checklist again. The ticks are still there.
      </span>
      <button type="button" onClick={reset} className="w-fit cursor-pointer text-sm underline">
        Clear saved progress
      </button>
    </div>
  );

  return (
    <Frame
      ui={ui}
      code={props.code}
      buttonText={list.isShown ? "Hide Checklist" : "Show Checklist"}
      onStart={list.toggle}
    />
  );
}

export function ChecklistEventsDemo(props: DemoProps) {
  const [lines, track, clear] = useLog();
  const list = useChecklist(() => ({
    id: "docs-events",
    title: "Get started",
    items: [
      {
        id: "tour",
        title: "Take the tour",
        tour: [
          { element: "#ce-app", popover: { title: "Your app", description: "Finish or close this tour." } },
          { popover: { title: "Last step", description: "Done ticks the item, closing doesn't." } },
        ],
      },
      { id: "invite", title: "Invite a teammate", action: () => {} },
    ],
    onEvent: event => {
      const extra = [event.itemId && `itemId: "${event.itemId}"`, event.reason && `reason: "${event.reason}"`]
        .filter(Boolean)
        .join(", ");
      track(`checklist_${event.type}${extra ? `  { ${extra} }` : ""}`);
    },
  }));

  function onToggle() {
    if (!list.isShown) {
      clear();
    }

    list.toggle();
  }

  const ui = (
    <div className={box}>
      <span id="ce-app" className="w-fit text-lg font-semibold">
        Website redesign
      </span>
      <Log id="ce-log" lines={lines} empty="Events show up here." />
    </div>
  );

  return (
    <Frame
      ui={ui}
      code={props.code}
      buttonText={list.isShown ? "Hide Checklist" : "Show Checklist"}
      onStart={onToggle}
    />
  );
}

export function OwnLauncherDemo(props: DemoProps) {
  const list = useChecklist(() => ({
    id: "docs-own-launcher",
    title: "Get started",
    launcher: false,
    items: [
      { id: "profile", title: "Fill in your profile", action: () => {} },
      { id: "invite", title: "Invite a teammate", action: () => {} },
    ],
  }));

  function toggle() {
    list.instance.current?.toggle();
  }

  const ui = (
    <div className={box}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">Dashboard</span>
        <button id="ol-help" type="button" onClick={toggle} disabled={!list.isShown} className={primary}>
          Getting started
        </button>
      </div>
      <span className="text-sm text-gray-500">
        {list.isShown ? "No floating button: Getting started opens the panel." : "Set up the checklist first."}
      </span>
    </div>
  );

  return (
    <Frame
      ui={ui}
      code={props.code}
      buttonText={list.isShown ? "Remove Checklist" : "Set Up Checklist"}
      onStart={list.toggle}
    />
  );
}

const MULTI_PAGE_KEY = "driver-docs-multi-page-tour";
const MULTI_PAGE_TTL = 5 * 60_000;
const START_PAGE = "/docs/multi-page-tours";
const NEXT_PAGE = "/docs/resume-a-tour";

type SavedProgress = { step: number; page: string; savedAt: number };

function currentPage() {
  return window.location.pathname.replace(/\.html$/, "").replace(/\/$/, "");
}

function takeProgress(): SavedProgress | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(MULTI_PAGE_KEY) ?? "null") as SavedProgress | null;
    window.sessionStorage.removeItem(MULTI_PAGE_KEY);
    const isFresh = !!saved && Date.now() - saved.savedAt < MULTI_PAGE_TTL;

    return isFresh && saved!.page === currentPage() ? saved : null;
  } catch {
    return null;
  }
}

function saveProgress(progress: SavedProgress | undefined) {
  try {
    if (!progress) {
      window.sessionStorage.removeItem(MULTI_PAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(MULTI_PAGE_KEY, JSON.stringify(progress));
  } catch {
    return;
  }
}

function visibleLink(href: string, fallback?: string): Element {
  const links = Array.from(document.querySelectorAll(`a[href="${href}"]`));
  const sidebarLink = links.find(link => link.closest("#docs-sidebar") && link.getClientRects().length > 0);
  const contentLink = links.find(link => !link.closest("#docs-sidebar") && link.getClientRects().length > 0);

  return (sidebarLink ?? (fallback ? document.querySelector(fallback) : null) ?? contentLink)!;
}

function goTo(page: string) {
  navigate(page).catch(() => window.location.assign(page));
}

function createMultiPageTour() {
  let isNavigating = false;

  const tour = driver({
    animate: true,
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    steps: [
      {
        element: "h1",
        popover: {
          title: "A tour across pages",
          description: "It starts on this page and carries on on another one.",
          side: "bottom",
          align: "start",
        },
      },
      {
        element: () => visibleLink(NEXT_PAGE, "#mp-next"),
        advanceOn: "click",
        popover: {
          title: "Go to another page",
          instruction: "Click <b>Resume a Tour</b>.",
          side: "right",
          align: "center",
          onNextClick: () => {
            isNavigating = true;
            saveProgress({ step: 2, page: NEXT_PAGE, savedAt: Date.now() });
            tour.destroy();
          },
        },
      },
      {
        element: "h1",
        waitForElement: 3000,
        popover: {
          title: "Same tour, new page",
          description: "The page changed and the tour picked up at the next step. Previous goes back a page.",
          side: "bottom",
          align: "start",
          onPrevClick: () => {
            isNavigating = true;
            saveProgress({ step: 1, page: START_PAGE, savedAt: Date.now() });
            tour.destroy();
            goTo(START_PAGE);
          },
        },
      },
      {
        element: () => visibleLink(START_PAGE),
        popover: {
          title: "That's the tour",
          description: "Done ends it, and it won't come back on its own. The code is on Multi-Page Tours.",
          side: "right",
          align: "center",
        },
      },
    ],
    onDestroyed: () => {
      if (!isNavigating) {
        saveProgress(undefined);
      }
    },
  });

  return tour;
}

function useMultiPageTour() {
  const tour = useRef<Driver | null>(null);

  useEffect(() => {
    return () => tour.current?.destroy();
  }, []);

  return (step?: number) => {
    tour.current = createMultiPageTour();
    tour.current.drive(step);
  };
}

function useResumeMultiPageTour(start: (step?: number) => void) {
  useEffect(() => {
    const saved = takeProgress();
    if (!saved) {
      return;
    }

    start(saved.step);
  }, []);
}

export function MultiPageTourDemo(props: DemoProps) {
  const start = useMultiPageTour();
  useResumeMultiPageTour(start);

  const ui = (
    <div className={box}>
      <span className="text-sm text-gray-500">
        The tour continues on the next page. Close it any time, and it stays closed.
      </span>
      <a id="mp-next" href={NEXT_PAGE} className="w-fit text-sm underline">
        Next page: Resume a Tour
      </a>
    </div>
  );

  return <Frame ui={ui} code={props.code} buttonText="Start the Tour" onStart={() => start()} />;
}

export function MultiPageTourResume() {
  const start = useMultiPageTour();
  useResumeMultiPageTour(start);

  return null;
}
