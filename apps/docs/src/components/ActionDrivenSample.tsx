import { useEffect, useRef, useState } from "react";
import type { Config, Driver, DriveStep } from "driver.js";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

type Scenario = "invite" | "toggle" | "plan" | "save" | "feedback" | "menu" | "load";

type ActionDrivenSampleProps = {
  scenario?: Scenario;
  children?: any;
};

type DemoProps = {
  code?: any;
};

const box = "flex flex-col gap-3 rounded-lg border border-gray-200 p-5";
const field = "rounded-md border border-gray-300 px-3 py-2 text-sm";
const primary = "cursor-pointer rounded-md bg-black px-4 py-2 text-sm text-white";
const secondary = "cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm";

const blockOutside: Config["onInteraction"] = (element, step, opts) => {
  if (opts.region !== "outside") {
    return;
  }

  opts.driver.nudge({ description: step.data?.hint });
  return false;
};

function useTour() {
  const tour = useRef<Driver | null>(null);

  useEffect(() => {
    return () => tour.current?.destroy();
  }, []);

  return (config: Config) => {
    tour.current = driver({ animate: true, showButtons: ["close"], ...config });
    tour.current.drive();
  };
}

function Frame(props: { ui: any; code?: any; onStart: () => void }) {
  return (
    <div className="my-6">
      {props.ui}
      {props.code && <div className="mt-4 -mb-4">{props.code}</div>}
      <button type="button" onClick={props.onStart} className="mt-4 w-full rounded-md bg-black p-2 text-white">
        Show me an Example
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

        opts.driver.nudge({ description: "That doesn't look like an email address yet." });
        return false;
      },
    },
    data: { hint: "Click the email field and type an address first." },
    popover: {
      title: "Who are you inviting?",
      description: "Type your teammate's email and press <b>Enter</b>.",
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

        opts.driver.nudge({ description: "Only editors can make changes. Choose <b>Editor</b>." });
        return false;
      },
    },
    data: { hint: "Pick a role from the dropdown first." },
    popover: {
      title: "Pick a role",
      description: "Choose <b>Editor</b> so they can make changes.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#invite-send",
    advanceOn: "click",
    data: { hint: "Click <b>Send invite</b> to finish." },
    popover: { title: "Send it", description: "Click <b>Send invite</b>.", side: "bottom", align: "start" },
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
    start({ onInteraction: blockOutside, steps: inviteSteps });
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
      steps: [
        {
          element: "#ad-save",
          onHighlighted: (element, step, opts) => {
            window.addEventListener("profile-saved", () => opts.driver.moveNext(), { signal: opts.signal });
          },
          popover: {
            title: "Save your profile",
            description: "Click <b>Save</b>. The tour moves on once the save finishes.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-saved",
          waitForElement: 1000,
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
          opts.driver.nudge({ description: "That was a right-click. <b>Double-click</b> instead." });
          return false;
        }

        if (opts.region === "outside") {
          opts.driver.nudge({ description: "Stay on the file. <b>Double-click</b> it." });
          return false;
        }
      },
      steps: [
        {
          element: "#ad-file",
          advanceOn: "dblclick",
          popover: {
            title: "Open the file",
            description: "Double-click <b>report.pdf</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#ad-opened",
          waitForElement: 1000,
          popover: {
            title: "Opened",
            description: "Right-clicks and clicks elsewhere were blocked with a hint.",
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
      onInteraction: (element, step, opts) => {
        const isDelete = (opts.event.target as Element).closest("[data-action=delete]");
        if (isDelete) {
          opts.driver.nudge({ description: "Not Delete. Choose <b>Archive</b>." });
          return false;
        }

        if (opts.region === "outside") {
          opts.driver.nudge({ description: step.data?.hint });
          return false;
        }
      },
      onElementMissing: (element, step, opts) => {
        if (opts.cause === "removed") {
          opts.driver.movePrevious();
          opts.driver.updatePopover({ description: "The menu closed. Click <b>More</b> to open it again." });
        }
      },
      steps: [
        {
          element: "#ad-more",
          advanceOn: "click",
          allowedElements: ".ad-menu",
          data: { hint: "Click <b>More</b> to open the menu." },
          popover: { title: "Open the menu", description: "Click <b>More</b>.", side: "bottom", align: "end" },
        },
        {
          element: ".ad-menu [data-action=archive]",
          waitForElement: 500,
          advanceOn: "click",
          allowedElements: [".ad-menu", "#ad-more"],
          data: { hint: "Choose <b>Archive</b> from the menu." },
          popover: {
            title: "Archive it",
            description: "Choose <b>Archive</b>. Press Escape to see the tour recover.",
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
              className="rounded px-3 py-1.5 text-left hover:bg-gray-100"
            >
              Archive
            </button>
            <button
              type="button"
              role="menuitem"
              data-action="delete"
              onClick={() => setIsMenuOpen(false)}
              className="rounded px-3 py-1.5 text-left text-red-600 hover:bg-gray-100"
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

const demos = {
  invite: InviteDemo,
  toggle: ToggleDemo,
  plan: PlanDemo,
  save: SaveDemo,
  feedback: FeedbackDemo,
  menu: MenuDemo,
  load: LoadDemo,
};

export function ActionDrivenSample(props: ActionDrivenSampleProps) {
  const Demo = demos[props.scenario ?? "invite"];

  return <Demo code={props.children} />;
}
