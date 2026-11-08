import { useEffect, useRef, useState } from "react";
import type { Driver, DriveStep } from "driver.js";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

type ActionDrivenSampleProps = {
  children?: any;
};

const steps: DriveStep[] = [
  {
    element: "#invite-email",
    advanceOn: (element, step, opts) => {
      const input = element as HTMLInputElement;
      input.addEventListener(
        "keydown",
        event => {
          if (event.key !== "Enter") {
            return;
          }

          if (input.checkValidity() && input.value) {
            opts.next();
            return;
          }

          opts.driver.updatePopover({ description: "That doesn't look like an email address yet." });
          opts.driver.nudge();
        },
        { signal: opts.signal }
      );
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
    advanceOn: (element, step, opts) => {
      const select = element as HTMLSelectElement;
      select.addEventListener(
        "change",
        () => {
          if (select.value === "editor") {
            opts.next();
            return;
          }

          opts.driver.updatePopover({ description: "Viewers can only look around. Choose <b>Editor</b>." });
          opts.driver.nudge();
        },
        { signal: opts.signal }
      );
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
    popover: {
      title: "Send it",
      description: "Click <b>Send invite</b>.",
      side: "bottom",
      align: "start",
    },
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

export function ActionDrivenSample(props: ActionDrivenSampleProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const tour = useRef<Driver | null>(null);

  useEffect(() => {
    return () => tour.current?.destroy();
  }, []);

  function sendInvite() {
    setStatus("sending");
    window.setTimeout(() => setStatus("sent"), 800);
  }

  function startTour() {
    formRef.current?.reset();
    setStatus("idle");

    tour.current = driver({
      animate: true,
      showButtons: ["close"],
      allowKeyboardControl: false,
      overlayClickBehavior: "none",
      onInteraction: (element, step, opts) => {
        if (opts.event.type === "keydown" || opts.region !== "outside") {
          return;
        }

        opts.driver.updatePopover({ description: step.data?.hint });
        opts.driver.nudge();
        return false;
      },
      steps,
    });
    tour.current.drive();
  }

  return (
    <div className="my-6">
      <form
        ref={formRef}
        onSubmit={event => event.preventDefault()}
        className="flex flex-col gap-3 rounded-lg border border-gray-200 p-5"
      >
        <span className="text-lg font-semibold">Invite a teammate</span>
        <input
          id="invite-email"
          type="email"
          placeholder="name@company.com"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select id="invite-role" defaultValue="viewer" className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex items-center gap-3">
          <button
            id="invite-send"
            type="button"
            onClick={sendInvite}
            disabled={status === "sending"}
            className="cursor-pointer rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            {status === "sending" ? "Sending..." : "Send invite"}
          </button>
          {status === "sent" && (
            <span id="invite-sent" className="text-sm text-green-700">
              Invite sent
            </span>
          )}
        </div>
      </form>
      {props.children && <div className="mt-4 -mb-4">{props.children}</div>}
      <button type="button" onClick={startTour} className="mt-4 w-full rounded-md bg-black p-2 text-white">
        Show me an Example
      </button>
    </div>
  );
}
