import { useEffect, useRef, useState } from "react";
import { box, type DemoProps, field, Frame, primary, secondary, useTour } from "./ActionDrivenSample";

type Scenario = "dialog" | "optional" | "rerender" | "resume";

type InteractiveSampleProps = {
  scenario: Scenario;
  children?: any;
};

const RESUME_KEY = "driver-docs-resume-step";

function DialogDemo(props: DemoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const start = useTour();

  function openDialog() {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }

  function createProject() {
    setIsCreated(true);
    dialogRef.current?.close();
  }

  function onStart() {
    dialogRef.current?.close();
    setIsCreated(false);
    start({
      steps: [
        {
          element: "#is-new-project",
          advanceOn: "click",
          popover: {
            title: "Start a project",
            instruction: "Click <b>New project</b>.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#is-project-name",
          waitForElement: 1000,
          popover: {
            title: "Name it",
            description: "The tour dims the dialog too and keeps its popover above it.",
            showButtons: ["next", "close"],
            side: "top",
            align: "start",
          },
        },
        {
          element: "#is-create",
          advanceOn: "click",
          popover: { title: "Create it", instruction: "Click <b>Create</b>.", side: "bottom", align: "start" },
        },
        {
          element: "#is-created",
          waitForElement: 1000,
          popover: {
            title: "Created",
            description: "The dialog closed and the tour moved back to the page.",
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
      <span className="text-lg font-semibold">Projects</span>
      <div className="flex items-center gap-3">
        <button id="is-new-project" type="button" onClick={openDialog} className={primary}>
          New project
        </button>
        {isCreated && (
          <span id="is-created" className="text-sm text-green-700">
            Project created
          </span>
        )}
      </div>
      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        className="m-auto w-80 rounded-lg border border-gray-200 p-5 backdrop:bg-black/40"
      >
        {isOpen && (
          <div className="flex flex-col gap-3">
            <span className="text-lg font-semibold">New project</span>
            <input id="is-project-name" defaultValue="Website redesign" className={field} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => dialogRef.current?.close()} className={secondary}>
                Cancel
              </button>
              <button id="is-create" type="button" onClick={createProject} className={primary}>
                Create
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function OptionalDemo(props: DemoProps) {
  const [hasBanner, setHasBanner] = useState(false);
  const start = useTour();

  function onStart() {
    start({
      showButtons: ["next", "previous", "close"],
      steps: [
        {
          element: "#is-stats",
          popover: { title: "Your numbers", description: "Updated every hour.", side: "bottom", align: "start" },
        },
        {
          element: "#is-banner",
          skipMissingElement: true,
          popover: {
            title: "Trial banner",
            description: "Only trial accounts see this step.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: "#is-export",
          popover: { title: "Export", description: "Download the numbers as CSV.", side: "bottom", align: "start" },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={hasBanner} onChange={event => setHasBanner(event.target.checked)} />
        Trial account (shows the banner)
      </label>
      {hasBanner && (
        <div id="is-banner" className="rounded-md bg-yellow-100 px-3 py-2 text-sm">
          12 days left in your trial
        </div>
      )}
      <div className="flex items-center justify-between">
        <span id="is-stats" className="text-sm">
          1,204 visits this week
        </span>
        <button id="is-export" type="button" className={secondary}>
          Export
        </button>
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function RerenderDemo(props: DemoProps) {
  const [version, setVersion] = useState(1);
  const start = useTour();

  function onStart() {
    setVersion(1);
    start({
      showButtons: ["next", "close"],
      steps: [
        {
          element: "#is-sync-row",
          popover: {
            title: "Sync status",
            description: "Click <b>Sync now</b> a few times. Each click replaces this row with a new element.",
            side: "bottom",
            align: "start",
          },
        },
      ],
    });
  }

  const ui = (
    <div className={box}>
      <span className="text-lg font-semibold">Integrations</span>
      <div
        key={version}
        id="is-sync-row"
        className="flex w-fit items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm"
      >
        <span>Rendered {version === 1 ? "once" : `${version} times`}</span>
        <button type="button" onClick={() => setVersion(version + 1)} className={secondary}>
          Sync now
        </button>
      </div>
    </div>
  );

  return <Frame ui={ui} code={props.code} onStart={onStart} />;
}

function readSavedStep(): number | undefined {
  try {
    const saved = window.localStorage.getItem(RESUME_KEY);

    return saved === null ? undefined : Number(saved);
  } catch {
    return undefined;
  }
}

function writeSavedStep(index: number | undefined) {
  try {
    if (index === undefined) {
      window.localStorage.removeItem(RESUME_KEY);
      return;
    }

    window.localStorage.setItem(RESUME_KEY, String(index));
  } catch {
    return;
  }
}

function ResumeDemo(props: DemoProps) {
  const [savedStep, setSavedStep] = useState<number | undefined>(undefined);
  const start = useTour();
  const sections = ["Overview", "Reports", "Team", "Settings"];

  useEffect(() => {
    setSavedStep(readSavedStep());
  }, []);

  function save(index: number | undefined) {
    writeSavedStep(index);
    setSavedStep(index);
  }

  function onStart() {
    start(
      {
        showProgress: true,
        showButtons: ["next", "previous", "close"],
        steps: sections.map(section => ({
          element: `#is-nav-${section.toLowerCase()}`,
          popover: {
            title: section,
            description: "Close the tour here, then start it again.",
            side: "bottom",
            align: "start",
          },
        })),
        onDestroyed: (element, step, opts) => {
          save(opts.reason === "done" ? undefined : opts.index);
        },
      },
      savedStep
    );
  }

  const ui = (
    <div className={box}>
      <div className="flex w-fit gap-2">
        {sections.map(section => (
          <button key={section} id={`is-nav-${section.toLowerCase()}`} type="button" className={secondary}>
            {section}
          </button>
        ))}
      </div>
      <span className="text-sm text-gray-500">
        {savedStep === undefined ? "No saved progress" : `Saved progress: step ${savedStep + 1}`}
      </span>
    </div>
  );

  return (
    <Frame
      ui={ui}
      code={props.code}
      buttonText={savedStep === undefined ? "Show me an Example" : `Resume at Step ${savedStep + 1}`}
      onStart={onStart}
    />
  );
}

const demos = {
  dialog: DialogDemo,
  optional: OptionalDemo,
  rerender: RerenderDemo,
  resume: ResumeDemo,
};

export function InteractiveSample(props: InteractiveSampleProps) {
  const Demo = demos[props.scenario];

  return <Demo code={props.children} />;
}
