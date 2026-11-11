import { useEffect, useRef, useState } from "react";
import type { DriveStep } from "driver.js";
import { driver } from "driver.js";
import type { Checklist } from "driver.js/checklist";
import { checklist } from "driver.js/checklist";
import "driver.js/dist/driver.css";
import "driver.js/dist/checklist.css";
import { box, type DemoProps, field, Frame, menuItem, primary, secondary, useTour } from "./ActionDrivenSample";

type Scenario =
  | "onboarding"
  | "form"
  | "menu"
  | "announce"
  | "help-menu"
  | "gestures"
  | "checklist"
  | "buttons"
  | "brand";

type RecipeSampleProps = {
  scenario: Scenario;
  children?: any;
};

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(key: string, isSet: boolean) {
  try {
    if (isSet) {
      window.localStorage.setItem(key, "1");
      return;
    }

    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

function useFlag(key: string): [boolean, (isSet: boolean) => void] {
  const [isSet, setIsSet] = useState(false);

  useEffect(() => {
    setIsSet(readFlag(key));
  }, [key]);

  function update(next: boolean) {
    writeFlag(key, next);
    setIsSet(next);
  }

  return [isSet, update];
}

const ONBOARDING_KEY = "driver-docs-onboarding-seen";

function OnboardingDemo(props: DemoProps) {
  const [isSeen, setIsSeen] = useFlag(ONBOARDING_KEY);
  const [message, setMessage] = useState("");
  const start = useTour();

  function startTour() {
    setMessage("");
    start({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      steps: [
        {
          element: "#fr-projects",
          popover: {
            title: "Your projects",
            description: "Everything you work on lives here.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#fr-invite",
          popover: { title: "Invite your team", description: "Work together on any project.", side: "bottom" },
        },
        {
          element: "#fr-replay",
          popover: {
            title: "Replay any time",
            description: "Load the page again: the tour stays away. This button brings it back.",
            side: "bottom",
            align: "end",
          },
        },
      ],
      onDestroyed: () => setIsSeen(true),
    });
  }

  function onLoadPage() {
    if (readFlag(ONBOARDING_KEY)) {
      setMessage("Page loaded. The tour was seen before, so it stays hidden.");
      return;
    }

    startTour();
  }

  const ui = (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id="fr-projects" className="text-lg font-semibold">
          Projects
        </span>
        <span className="flex gap-2">
          <button id="fr-invite" type="button" className={secondary}>
            Invite
          </button>
          <button id="fr-replay" type="button" onClick={startTour} className={secondary}>
            Replay tour
          </button>
        </span>
      </div>
      <span className="text-sm text-gray-500">
        {message || (isSeen ? "Tour seen: it won't start on load." : "First visit: the tour starts on load.")}
      </span>
      {isSeen && (
        <button
          type="button"
          onClick={() => {
            setIsSeen(false);
            setMessage("");
          }}
          className="w-fit cursor-pointer text-sm underline"
        >
          Forget that I've seen it
        </button>
      )}
    </div>
  );

  return <Frame ui={ui} code={props.code} buttonText="Load the Page" onStart={onLoadPage} />;
}

function FormDemo(props: DemoProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isCreated, setIsCreated] = useState(false);
  const start = useTour();

  function onStart() {
    formRef.current?.reset();
    setIsCreated(false);
    start({
      showButtons: ["next", "close"],
      steps: [
        {
          element: "#tf-password",
          advanceOn: {
            event: "input",
            when: element => (element as HTMLInputElement).value.length >= 8,
          },
          advanceDelay: 800,
          popover: {
            title: "Choose a password",
            instruction: "Type at least 8 characters.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tf-terms",
          advanceOn: "change",
          popover: { title: "The fine print", instruction: "Accept the terms.", side: "bottom", align: "start" },
        },
        {
          element: "#tf-submit",
          advanceOn: "click",
          popover: {
            title: "Create the account",
            instruction: "Click <b>Create account</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#tf-created",
          waitForElement: 1000,
          popover: {
            title: "Account created",
            description: "Each step waited for the field to be right.",
            showButtons: ["next"],
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <form ref={formRef} onSubmit={event => event.preventDefault()} className={box}>
      <span className="text-lg font-semibold">Create your account</span>
      <input type="email" defaultValue="sam@example.com" className={field} />
      <input id="tf-password" type="password" placeholder="Password" className={field} />
      <label id="tf-terms" className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" />I accept the terms
      </label>
      <div className="flex items-center gap-3">
        <button id="tf-submit" type="button" onClick={() => setIsCreated(true)} className={primary}>
          Create account
        </button>
        {isCreated && (
          <span id="tf-created" className="text-sm text-green-700">
            Welcome aboard
          </span>
        )}
      </div>
    </form>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function MenuDemo(props: DemoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState("Dashboard");
  const menuRef = useRef<HTMLDivElement>(null);
  const start = useTour();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [isOpen]);

  function pick(item: string) {
    setIsOpen(false);
    setScreen(item);
  }

  function onStart() {
    setIsOpen(false);
    setScreen("Dashboard");
    start({
      showButtons: ["next", "close"],
      onElementMissing: "previousAction",
      steps: [
        {
          element: "#wm-account",
          advanceOn: "click",
          allowedElements: ".wm-menu",
          popover: {
            title: "Your account",
            instruction: "Click <b>Account</b>.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: ".wm-menu [data-item=settings]",
          waitForElement: 500,
          advanceOn: "click",
          allowedElements: [".wm-menu", "#wm-account"],
          popover: {
            title: "Open settings",
            description: "Pick something else, or press Escape, and the tour goes back a step.",
            instruction: "Choose <b>Settings</b>.",
            side: "left",
            align: "start",
          },
        },
        {
          element: "#wm-screen",
          popover: {
            title: "Settings",
            description: "The menu worked as usual, and the tour followed along.",
            showButtons: ["next"],
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <div className="relative flex items-center justify-between">
        <span id="wm-screen" className="text-lg font-semibold">
          {screen}
        </span>
        <button id="wm-account" type="button" onClick={() => setIsOpen(!isOpen)} className={secondary}>
          Account
        </button>
        {isOpen && (
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={event => event.key === "Escape" && setIsOpen(false)}
            onMouseDown={event => event.preventDefault()}
            className="wm-menu absolute top-full right-0 z-10 mt-1 flex w-36 flex-col rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          >
            {["Profile", "Settings", "Sign out"].map(item => (
              <button
                key={item}
                type="button"
                role="menuitem"
                data-item={item.toLowerCase()}
                onClick={() => pick(item)}
                className={menuItem}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-500">Open the account menu to switch screens.</span>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

const ANNOUNCE_KEY = "driver-docs-seen-pdf-export";

function AnnounceDemo(props: DemoProps) {
  const [isSeen, setIsSeen] = useFlag(ANNOUNCE_KEY);
  const [message, setMessage] = useState("");
  const tour = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    return () => tour.current?.destroy();
  }, []);

  function onLoadPage() {
    if (readFlag(ANNOUNCE_KEY)) {
      setMessage("Page loaded. You've seen the announcement, so nothing shows.");
      return;
    }

    setMessage("");
    tour.current = driver({
      animate: true,
      onDestroyed: () => setIsSeen(true),
    });
    tour.current.highlight({
      element: "#af-export",
      popover: {
        title: "New: export to PDF",
        description: "Download any report as a PDF. This shows once.",
        showButtons: ["close"],
        side: "bottom",
        align: "end",
      },
    });
  }

  const ui = (
    <div className={box}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">Q3 report</span>
        <button id="af-export" type="button" className={secondary}>
          Export PDF
        </button>
      </div>
      <span className="text-sm text-gray-500">
        {message || (isSeen ? "Announcement seen." : "Not seen yet: it shows on load.")}
      </span>
      {isSeen && (
        <button
          type="button"
          onClick={() => {
            setIsSeen(false);
            setMessage("");
          }}
          className="w-fit cursor-pointer text-sm underline"
        >
          Forget that I've seen it
        </button>
      )}
    </div>
  );

  return <Frame ui={ui} code={props.code} buttonText="Load the Page" onStart={onLoadPage} />;
}

const currentTab = "cursor-pointer rounded-md border border-black bg-black px-3 py-1.5 text-sm text-white";

const screens = [
  { id: "inbox", title: "Inbox", description: "Messages from your team land here." },
  { id: "reports", title: "Reports", description: "Weekly numbers, ready to share." },
  { id: "settings", title: "Settings", description: "Notifications, billing and your profile." },
];

function HelpMenuDemo(props: DemoProps) {
  const [screen, setScreen] = useState("reports");
  const start = useTour();

  const steps: DriveStep[] = screens.map(item => ({
    element: `#hm-tab-${item.id}`,
    data: { screen: item.id },
    onHighlighted: () => setScreen(item.id),
    popover: { title: item.title, description: item.description, side: "bottom", align: "start" },
  }));

  function onStart() {
    const index = steps.findIndex(step => step.data?.screen === screen);
    start({ showProgress: true, showButtons: ["next", "previous", "close"], steps }, Math.max(index, 0));
  }

  const ui = (
    <div className={box}>
      <div className="flex w-fit gap-2">
        {screens.map(item => (
          <button
            key={item.id}
            id={`hm-tab-${item.id}`}
            type="button"
            onClick={() => setScreen(item.id)}
            className={screen === item.id ? currentTab : secondary}
          >
            {item.title}
          </button>
        ))}
      </div>
      <span className="text-sm text-gray-500">
        Pick a screen, then take the tour. It starts at that screen&apos;s step.
      </span>
    </div>
  );

  return <Frame ui={ui} code={props.code} buttonText="Help: Take the Tour" onStart={onStart} />;
}

function GesturesDemo(props: DemoProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasCopy, setHasCopy] = useState(false);
  const [opened, setOpened] = useState("");
  const start = useTour();

  function onStart() {
    setIsMenuOpen(false);
    setHasCopy(false);
    setOpened("");
    start({
      showButtons: ["close"],
      onElementMissing: "previousAction",
      steps: [
        {
          element: "#rc-file",
          advanceOn: { event: "contextmenu", strict: true },
          allowedElements: ".rc-menu",
          popover: {
            title: "Copy the file",
            description: "A left click is blocked here and shakes the popover.",
            instruction: "Right-click <b>report.pdf</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: ".rc-menu [data-action=duplicate]",
          waitForElement: 500,
          advanceOn: "click",
          allowedElements: ".rc-menu",
          popover: { title: "Duplicate it", instruction: "Choose <b>Duplicate</b>.", side: "right", align: "start" },
        },
        {
          element: "#rc-copy",
          waitForElement: 1000,
          advanceOn: { event: "dblclick", strict: true },
          popover: {
            title: "Open the copy",
            instruction: "Double-click <b>report copy.pdf</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#rc-opened",
          waitForElement: 1000,
          popover: { title: "Opened", showButtons: ["next"], side: "bottom", align: "start" },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <span className="text-lg font-semibold">Files</span>
      <div className="relative flex flex-wrap items-center gap-3">
        <button
          id="rc-file"
          type="button"
          onContextMenu={event => {
            event.preventDefault();
            setIsMenuOpen(true);
          }}
          className={secondary}
        >
          report.pdf
        </button>
        {hasCopy && (
          <button id="rc-copy" type="button" onDoubleClick={() => setOpened("report copy.pdf")} className={secondary}>
            report copy.pdf
          </button>
        )}
        {isMenuOpen && (
          <div
            role="menu"
            onMouseDown={event => event.preventDefault()}
            className="rc-menu absolute top-full left-0 z-10 mt-1 flex w-36 flex-col rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              data-action="duplicate"
              onClick={() => {
                setHasCopy(true);
                setIsMenuOpen(false);
              }}
              className={menuItem}
            >
              Duplicate
            </button>
            <button type="button" role="menuitem" onClick={() => setIsMenuOpen(false)} className={menuItem}>
              Close menu
            </button>
          </div>
        )}
      </div>
      {opened && (
        <span id="rc-opened" className="text-sm text-green-700">
          Opened {opened}
        </span>
      )}
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function ChecklistDemo(props: DemoProps) {
  const instance = useRef<Checklist | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    return () => instance.current?.hide();
  }, []);

  function createChecklist() {
    return checklist({
      id: "docs-recipe-get-started",
      title: "Get started",
      description: "Three short tours, one minute each.",
      items: [
        {
          id: "project",
          title: "Create a project",
          tour: [
            {
              element: "#gc-new-project",
              popover: { title: "New project", description: "Start every project here.", side: "bottom" },
            },
          ],
        },
        {
          id: "invite",
          title: "Invite your team",
          tour: [
            {
              element: "#gc-invite",
              popover: { title: "Invite", description: "Add teammates by email.", side: "bottom" },
            },
            {
              element: "#gc-members",
              popover: { title: "Members", description: "Everyone on the project.", side: "top", align: "start" },
            },
          ],
        },
        {
          id: "billing",
          title: "Add billing details",
          tour: [
            {
              element: "#gc-billing",
              popover: { title: "Billing", description: "Plans and invoices live here.", side: "bottom" },
            },
          ],
        },
      ],
    });
  }

  function onToggle() {
    if (isVisible) {
      instance.current?.hide();
      setIsVisible(false);
      return;
    }

    instance.current = instance.current ?? createChecklist();
    instance.current.show();
    instance.current.open();
    setIsVisible(true);
  }

  const ui = (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-semibold">Website redesign</span>
        <span className="flex gap-2">
          <button id="gc-new-project" type="button" className={primary}>
            New project
          </button>
          <button id="gc-invite" type="button" className={secondary}>
            Invite
          </button>
          <button id="gc-billing" type="button" className={secondary}>
            Billing
          </button>
        </span>
      </div>
      <span id="gc-members" className="w-fit text-sm text-gray-500">
        3 members
      </span>
    </div>
  );

  return (
    <Frame ui={ui} code={props.code} buttonText={isVisible ? "Hide Checklist" : "Show Checklist"} onStart={onToggle} />
  );
}

function ButtonsDemo(props: DemoProps) {
  const start = useTour();

  function onStart() {
    start({
      showProgress: true,
      showButtons: ["next", "previous"],
      steps: [
        {
          element: "#cb-search",
          popover: { title: "Search", description: "Skip tour ends it from any step.", side: "bottom", align: "start" },
        },
        {
          element: "#cb-filters",
          popover: { title: "Filters", description: "Narrow the list down.", side: "bottom", align: "start" },
        },
        {
          element: "#cb-export",
          popover: { title: "Export", description: "Restart takes you back to the start.", side: "bottom" },
        },
      ],
      onPopoverRender: (popover, opts) => {
        const button = document.createElement("button");
        button.className = "driver-popover-footer-btn";

        if (opts.driver.isLastStep()) {
          button.innerText = "Restart";
          button.addEventListener("click", () => opts.driver.drive(0));
        } else {
          button.innerText = "Skip tour";
          button.addEventListener("click", () => opts.driver.destroy());
        }

        popover.footerButtons.prepend(button);
      },
    });
  }

  const ui = (
    <div className={box}>
      <div className="flex flex-wrap items-center gap-2">
        <input id="cb-search" placeholder="Search orders" className={field} />
        <button id="cb-filters" type="button" className={secondary}>
          Filters
        </button>
        <button id="cb-export" type="button" className={secondary}>
          Export
        </button>
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

const brandStyles = `
.driver-popover.docs-dark {
  background: #18181b;
  color: #d4d4d8;
  --driver-instruction-background: #27272a;
  --driver-instruction-indicator-color: #a78bfa;
}
.docs-dark .driver-popover-title { color: #fff; }
.docs-dark .driver-popover-arrow-side-top { border-top-color: #18181b; }
.docs-dark .driver-popover-arrow-side-bottom { border-bottom-color: #18181b; }
.docs-dark .driver-popover-arrow-side-left { border-left-color: #18181b; }
.docs-dark .driver-popover-arrow-side-right { border-right-color: #18181b; }
.docs-dark .driver-popover-footer-btn {
  background: #27272a;
  color: #fff;
  border-color: #3f3f46;
  text-shadow: none;
}
.driver-popover.docs-brand {
  background: #4f46e5;
  color: #e0e7ff;
  border-radius: 12px;
  --driver-instruction-background: #4338ca;
  --driver-instruction-indicator-color: #fde047;
}
.docs-brand .driver-popover-title { color: #fff; }
.docs-brand .driver-popover-arrow-side-top { border-top-color: #4f46e5; }
.docs-brand .driver-popover-arrow-side-bottom { border-bottom-color: #4f46e5; }
.docs-brand .driver-popover-arrow-side-left { border-left-color: #4f46e5; }
.docs-brand .driver-popover-arrow-side-right { border-right-color: #4f46e5; }
.docs-brand .driver-popover-progress-text { color: #c7d2fe; }
.docs-brand .driver-popover-footer-btn {
  background: #fff;
  color: #4338ca;
  border: 0;
  border-radius: 999px;
  text-shadow: none;
}
`;

function BrandDemo(props: DemoProps) {
  const [theme, setTheme] = useState<"dark" | "brand">("dark");
  const start = useTour();

  function onStart() {
    start({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      popoverClass: `docs-${theme}`,
      overlayColor: theme === "dark" ? "#000" : "#1e1b4b",
      steps: [
        {
          element: "#mb-title",
          popover: {
            title: "Your brand",
            description: "Colors come from your own class.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#mb-publish",
          advanceOn: "click",
          popover: { title: "Action steps too", instruction: "Click <b>Publish</b>.", side: "bottom", align: "start" },
        },
        {
          popover: { title: "That's the theme", description: "Switch themes above and run it again." },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <style>{brandStyles}</style>
      <div className="flex items-center justify-between">
        <span id="mb-title" className="text-lg font-semibold">
          Landing page
        </span>
        <button id="mb-publish" type="button" className={primary}>
          Publish
        </button>
      </div>
      <div className="flex gap-4 text-sm">
        {(["dark", "brand"] as const).map(item => (
          <label key={item} className="flex cursor-pointer items-center gap-2 capitalize">
            <input type="radio" name="mb-theme" checked={theme === item} onChange={() => setTheme(item)} />
            {item}
          </label>
        ))}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

const demos = {
  onboarding: OnboardingDemo,
  form: FormDemo,
  menu: MenuDemo,
  announce: AnnounceDemo,
  "help-menu": HelpMenuDemo,
  gestures: GesturesDemo,
  checklist: ChecklistDemo,
  buttons: ButtonsDemo,
  brand: BrandDemo,
};

export function RecipeSample(props: RecipeSampleProps) {
  const Demo = demos[props.scenario];

  return <Demo code={props.children} />;
}
