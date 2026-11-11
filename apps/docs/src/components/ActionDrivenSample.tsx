import { useEffect, useRef, useState } from "react";
import type { Config, Driver, DriveStep } from "driver.js";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

type Scenario =
  | "invite"
  | "toggle"
  | "action"
  | "success"
  | "strict"
  | "plan"
  | "save"
  | "feedback"
  | "hover"
  | "menu"
  | "load"
  | "themed";

type ActionDrivenSampleProps = {
  scenario?: Scenario;
  children?: any;
};

export type DemoProps = {
  code?: any;
};

type FrameProps = {
  ui: any;
  code?: any;
  buttonText?: string;
  onStart: () => void;
};

export const box = "flex flex-col gap-3 rounded-lg border border-gray-200 p-5";
export const field = "rounded-md border border-gray-300 px-3 py-2 text-sm";
export const primary = "cursor-pointer rounded-md bg-black px-4 py-2 text-sm text-white";
export const secondary = "cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm";

// A raised allowed menu covers the step's cutout, so the item it holds
// marks itself as the active one.
export const menuItem = "rounded px-3 py-1.5 text-left text-sm hover:bg-gray-100";

export function useTour() {
  const tour = useRef<Driver | null>(null);

  useEffect(() => {
    return () => tour.current?.destroy();
  }, []);

  return (config: Config, stepIndex?: number) => {
    tour.current = driver({ animate: true, showButtons: ["close"], ...config });
    tour.current.drive(stepIndex);
  };
}

export function Frame(props: FrameProps) {
  const { ui, code, buttonText = "Show me an Example", onStart } = props;

  return (
    <div className="my-6">
      {ui}
      {code && <div className="mt-4 -mb-4">{code}</div>}
      <button type="button" onClick={onStart} className="mt-4 w-full rounded-md bg-black p-2 text-white">
        {buttonText}
      </button>
    </div>
  );
}

const inviteSteps: DriveStep[] = [
  {
    element: "#invite-email",
    advanceOn: {
      event: "keydown",
      when: (element, step, opts) => {
        const input = element as HTMLInputElement;
        if ((opts.event as KeyboardEvent).key !== "Enter") {
          return false;
        }

        if (input.checkValidity() && input.value) {
          return true;
        }

        opts.driver.nudge("That doesn't look like an email address yet.");
        return false;
      },
    },
    popover: {
      title: "Who are you inviting?",
      instruction: "Type your teammate's email and press <b>Enter</b>.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#invite-role",
    advanceOn: {
      event: "change",
      when: (element, step, opts) => {
        if ((element as HTMLSelectElement).value === "editor") {
          return true;
        }

        opts.driver.nudge("Only editors can make changes. Choose <b>Editor</b>.");
        return false;
      },
    },
    popover: {
      title: "Pick a role",
      instruction: "Choose <b>Editor</b> so they can make changes.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#invite-send",
    advanceOn: "click",
    popover: { title: "Send it", instruction: "Click <b>Send invite</b>.", side: "bottom", align: "start" },
  },
  {
    element: "#invite-sent",
    waitForElement: 3000,
    popover: {
      title: "Invite sent",
      description: "Each step waited for the real action, and wrong clicks got a hint instead.",
      showButtons: ["next"],
      side: "bottom",
      align: "start",
    },
  },
];

function InviteDemo(props: DemoProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const start = useTour();

  function sendInvite() {
    setStatus("sending");
    window.setTimeout(() => setStatus("sent"), 800);
  }

  function onStart() {
    formRef.current?.reset();
    setStatus("idle");
    start({ showButtons: ["next", "close"], steps: inviteSteps });
  }

  const ui = (
    <form ref={formRef} onSubmit={event => event.preventDefault()} className={box}>
      <span className="text-lg font-semibold">Invite a teammate</span>
      <input id="invite-email" type="email" placeholder="name@company.com" className={field} />
      <select id="invite-role" defaultValue="viewer" className={field}>
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
      <div className="flex items-center gap-3">
        <button id="invite-send" type="button" onClick={sendInvite} disabled={status === "sending"} className={primary}>
          {status === "sending" ? "Sending..." : "Send invite"}
        </button>
        {status === "sent" && (
          <span id="invite-sent" className="text-sm text-green-700">
            Invite sent
          </span>
        )}
      </div>
    </form>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function ToggleDemo(props: DemoProps) {
  const [isOn, setIsOn] = useState(false);
  const start = useTour();

  function onStart() {
    setIsOn(false);
    start({
      steps: [
        {
          element: "#ad-toggle",
          advanceOn: "change",
          popover: { title: "Turn on notifications", description: "Flip the switch.", side: "bottom", align: "start" },
        },
        {
          element: "#ad-toggle",
          popover: {
            title: "Notifications on",
            description: "The step moved on as soon as the switch changed.",
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
      <span className="text-lg font-semibold">Settings</span>
      <label id="ad-toggle" className="flex w-fit cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={isOn} onChange={event => setIsOn(event.target.checked)} className="size-4" />
        Email notifications
      </label>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function ActionDemo(props: DemoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const start = useTour();

  function onStart() {
    setIsOpen(false);
    start({
      showButtons: ["next", "previous", "close"],
      steps: [
        {
          element: "#ad-toolbar",
          popover: {
            title: "The toolbar",
            description: "Everything you use daily is one click away.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-inbox",
          advanceOn: "click",
          popover: {
            title: "Open your inbox",
            description: "New messages land here first.",
            instruction: "Click <b>Inbox</b> on the toolbar to open it.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-inbox-panel",
          waitForElement: 1000,
          popover: {
            title: "Your inbox",
            description: "The tour moved on as soon as you clicked.",
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <div id="ad-toolbar" className="flex w-fit gap-2">
        <button id="ad-inbox" type="button" onClick={() => setIsOpen(true)} className={secondary}>
          Inbox
        </button>
        <button type="button" className={secondary}>
          Calendar
        </button>
        <button type="button" className={secondary}>
          Files
        </button>
      </div>
      {isOpen && (
        <div id="ad-inbox-panel" className="rounded-md border border-gray-200 p-3 text-sm">
          3 unread messages
        </div>
      )}
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function SuccessDemo(props: DemoProps) {
  const [isStarred, setIsStarred] = useState(false);
  const start = useTour();

  function onStart() {
    setIsStarred(false);
    start({
      showButtons: ["next", "close"],
      steps: [
        {
          element: "#ad-star",
          advanceOn: "click",
          advanceDelay: 1200,
          popover: {
            title: "Star the project",
            description: "Watch the row and Next turn green before the tour moves on.",
            instruction: "Click <b>Star</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-starred",
          waitForElement: 1000,
          popover: {
            title: "Starred",
            description: "The pause showed the step was done.",
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
      <span className="text-lg font-semibold">Website redesign</span>
      <div className="flex items-center gap-3">
        <button id="ad-star" type="button" onClick={() => setIsStarred(true)} className={secondary}>
          {isStarred ? "Starred" : "Star"}
        </button>
        {isStarred && (
          <span id="ad-starred" className="text-sm text-gray-500">
            Added to your starred projects
          </span>
        )}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function StrictDemo(props: DemoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rightClicks, setRightClicks] = useState(0);
  const start = useTour();

  function onStart() {
    setIsOpen(false);
    setRightClicks(0);
    start({
      steps: [
        {
          element: "#ad-strict-file",
          advanceOn: { event: "dblclick", strict: true },
          popover: {
            title: "Open the file",
            description: "Right-click it first: the popover shakes and the app never sees it.",
            instruction: "Double-click <b>report.pdf</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-strict-opened",
          waitForElement: 1000,
          popover: {
            title: "Opened",
            description: "Only the double-click reached the app.",
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
      <span className="text-lg font-semibold">Files</span>
      <div className="flex items-center gap-4">
        <button
          id="ad-strict-file"
          type="button"
          onDoubleClick={() => setIsOpen(true)}
          onContextMenu={event => {
            event.preventDefault();
            setRightClicks(count => count + 1);
          }}
          className={secondary}
        >
          report.pdf
        </button>
        {isOpen && (
          <span id="ad-strict-opened" className="text-sm text-green-700">
            Opened report.pdf
          </span>
        )}
      </div>
      <span className="text-sm text-gray-500">Right-clicks the app handled: {rightClicks}</span>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function PlanDemo(props: DemoProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const start = useTour();

  function onStart() {
    formRef.current?.reset();
    start({
      steps: [
        {
          element: "#ad-plan",
          advanceOn: {
            event: "change",
            when: (element, step, opts) => {
              const picked = element.querySelector<HTMLInputElement>("input:checked")?.value;
              if (picked === "pro") {
                return true;
              }

              opts.driver.nudge({ description: "That plan has no reports. Pick <b>Pro</b>." });
              return false;
            },
          },
          popover: {
            title: "Pick a plan",
            description: "Choose <b>Pro</b> to get reports.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-plan",
          popover: {
            title: "Pro it is",
            description: "Wrong picks got a hint. The right one moved the tour on.",
            showButtons: ["next"],
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <form ref={formRef} className={box}>
      <span className="text-lg font-semibold">Choose a plan</span>
      <fieldset id="ad-plan" className="flex w-fit gap-4 text-sm">
        {["free", "pro", "team"].map(plan => (
          <label key={plan} className="flex cursor-pointer items-center gap-2 capitalize">
            <input type="radio" name="ad-plan" value={plan} defaultChecked={plan === "free"} />
            {plan}
          </label>
        ))}
      </fieldset>
    </form>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function SaveDemo(props: DemoProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const start = useTour();

  function save() {
    setStatus("saving");
    window.setTimeout(() => {
      setStatus("saved");
      window.dispatchEvent(new Event("profile-saved"));
    }, 1200);
  }

  function onStart() {
    setStatus("idle");
    start({
      showButtons: ["next", "close"],
      steps: [
        {
          element: "#ad-save",
          advanceDelay: 600,
          onHighlighted: (element, step, opts) => {
            window.addEventListener("profile-saved", () => opts.driver.advance(), { signal: opts.signal });
          },
          popover: {
            title: "Save your profile",
            description: "The tour moves on once the save finishes.",
            instruction: "Click <b>Save</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-saved",
          popover: {
            title: "Saved",
            description: "The tour waited for the app, not for the click.",
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
      <span className="text-lg font-semibold">Profile</span>
      <input defaultValue="Ada Lovelace" className={field} />
      <div className="flex items-center gap-3">
        <button id="ad-save" type="button" onClick={save} disabled={status === "saving"} className={primary}>
          {status === "saving" ? "Saving..." : "Save"}
        </button>
        {status === "saved" && (
          <span id="ad-saved" className="text-sm text-green-700">
            Saved
          </span>
        )}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function FeedbackDemo(props: DemoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const start = useTour();

  function onStart() {
    setIsOpen(false);
    start({
      onInteraction: (element, step, opts) => {
        if (opts.region === "element" && opts.event.type === "contextmenu") {
          opts.driver.nudge("That was a right-click. <b>Double-click</b> instead.");
          return false;
        }
      },
      steps: [
        {
          element: "#ad-file",
          advanceOn: "dblclick",
          popover: {
            title: "Open the file",
            instruction: "Double-click <b>report.pdf</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-opened",
          waitForElement: 1000,
          popover: {
            title: "Opened",
            description: "Right-clicks got a hint, and clicks elsewhere shook the popover.",
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
      <span className="text-lg font-semibold">Files</span>
      <div className="flex items-center gap-4">
        <button id="ad-file" type="button" onDoubleClick={() => setIsOpen(true)} className={secondary}>
          report.pdf
        </button>
        {isOpen && (
          <span id="ad-opened" className="text-sm text-green-700">
            Opened report.pdf
          </span>
        )}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function HoverDemo(props: DemoProps) {
  const [clicks, setClicks] = useState(0);
  const start = useTour();

  function onStart() {
    setClicks(0);
    start({
      showButtons: ["next", "close"],
      steps: [
        {
          element: "#ad-appointment",
          disableActiveInteraction: "clicks",
          popover: {
            title: "Appointment details",
            description: "Rest your mouse on it to see the details. Clicking it does nothing during this step.",
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <span className="text-lg font-semibold">Today</span>
      <button
        id="ad-appointment"
        type="button"
        onClick={() => setClicks(count => count + 1)}
        className="group relative w-fit cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-left text-sm hover:bg-gray-50"
      >
        10:30 Design review
        <span className="absolute top-full left-0 z-10 mt-1 hidden w-48 rounded-md bg-black px-3 py-2 text-xs text-white group-hover:block">
          Room 4, with Priya and Tom. 45 minutes.
        </span>
      </button>
      <span className="text-sm text-gray-500">Clicks the app handled: {clicks}</span>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function MenuDemo(props: DemoProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const start = useTour();

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [isMenuOpen]);

  function onStart() {
    setIsMenuOpen(false);
    setIsArchived(false);
    start({
      showButtons: ["next", "close"],
      onElementMissing: "previousAction",
      onInteraction: (element, step, opts) => {
        const isDelete = (opts.event.target as Element).closest("[data-action=delete]");
        if (isDelete) {
          opts.driver.nudge("Not Delete. Choose <b>Archive</b>.");
          return false;
        }
      },
      steps: [
        {
          element: "#ad-more",
          advanceOn: "click",
          allowedElements: ".ad-menu",
          popover: { title: "Open the menu", instruction: "Click <b>More</b>.", side: "bottom", align: "end" },
        },
        {
          element: ".ad-menu [data-action=archive]",
          waitForElement: 500,
          advanceOn: "click",
          allowedElements: [".ad-menu", "#ad-more"],
          popover: {
            title: "Archive it",
            description: "Press Escape to see the tour recover.",
            instruction: "Choose <b>Archive</b>.",
            side: "right",
            align: "start",
          },
        },
        {
          element: "#ad-archived",
          waitForElement: 1000,
          popover: {
            title: "Archived",
            description: "The menu stayed usable, Delete was blocked, and closing the menu sent you back a step.",
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
      <span className="text-lg font-semibold">Reports</span>
      <div className="relative flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm">
        <span>
          Q3 report
          {isArchived && (
            <span id="ad-archived" className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              Archived
            </span>
          )}
        </span>
        <button id="ad-more" type="button" onClick={() => setIsMenuOpen(!isMenuOpen)} className={secondary}>
          More
        </button>
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={event => event.key === "Escape" && setIsMenuOpen(false)}
            onMouseDown={event => event.preventDefault()}
            className="ad-menu absolute top-full right-0 z-10 mt-1 flex w-36 flex-col rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              data-action="archive"
              onClick={() => {
                setIsArchived(true);
                setIsMenuOpen(false);
              }}
              className={menuItem}
            >
              Archive
            </button>
            <button
              type="button"
              role="menuitem"
              data-action="delete"
              onClick={() => setIsMenuOpen(false)}
              className={`${menuItem} text-red-600`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function LoadDemo(props: DemoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const loads = useRef(0);
  const start = useTour();

  function load() {
    loads.current += 1;
    window.setTimeout(() => setIsLoaded(true), loads.current === 1 ? 2500 : 300);
  }

  function onStart() {
    loads.current = 0;
    setIsLoaded(false);
    start({
      onElementMissing: (element, step, opts) => {
        if (opts.cause === "timeout") {
          opts.driver.nudge({ description: "Still loading. Click <b>Load report</b> again." });
          return false;
        }
      },
      steps: [
        {
          element: "#ad-load",
          advanceOn: "click",
          popover: {
            title: "Load the report",
            description: "Click <b>Load report</b>. The first load is slow on purpose.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-report",
          waitForElement: 1500,
          popover: {
            title: "Loaded",
            description: "The slow load timed out, the tour kept you on the step, and the retry worked.",
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
      <span className="text-lg font-semibold">Analytics</span>
      <div className="flex items-center gap-3">
        <button id="ad-load" type="button" onClick={load} className={primary}>
          Load report
        </button>
        {isLoaded && (
          <span id="ad-report" className="text-sm text-green-700">
            Revenue is up 12%
          </span>
        )}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function ThemedDemo(props: DemoProps) {
  const [isPublished, setIsPublished] = useState(false);
  const start = useTour();

  function onStart() {
    setIsPublished(false);
    start({
      showButtons: ["next", "close"],
      popoverClass: "docs-action-theme",
      steps: [
        {
          element: "#ad-publish",
          advanceOn: "click",
          advanceDelay: 1200,
          popover: {
            title: "Publish the page",
            instruction: "Click <b>Publish</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-published",
          waitForElement: 1000,
          popover: {
            title: "Live",
            description: "The instruction row, its dot and the done state all came from CSS variables.",
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
      <span className="text-lg font-semibold">Landing page</span>
      <div className="flex items-center gap-3">
        <button id="ad-publish" type="button" onClick={() => setIsPublished(true)} className={primary}>
          Publish
        </button>
        {isPublished && (
          <span id="ad-published" className="text-sm text-green-700">
            Published
          </span>
        )}
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

const demos = {
  invite: InviteDemo,
  toggle: ToggleDemo,
  action: ActionDemo,
  success: SuccessDemo,
  strict: StrictDemo,
  plan: PlanDemo,
  save: SaveDemo,
  feedback: FeedbackDemo,
  hover: HoverDemo,
  menu: MenuDemo,
  load: LoadDemo,
  themed: ThemedDemo,
};

export function ActionDrivenSample(props: ActionDrivenSampleProps) {
  const Demo = demos[props.scenario ?? "invite"];

  return <Demo code={props.children} />;
}
