import { useEffect, useRef, useState } from "react";
import type { Driver } from "driver.js/headless";
import { box, field, Frame, primary, secondary } from "./ActionDrivenSample";
import { startPanelTour } from "../examples/headless/panel.js";
import { startAssistantTour } from "../examples/headless/assistant.js";
import { startSpotlightTour } from "../examples/headless/spotlight.js";
import { startInlineTour } from "../examples/headless/inline.js";
import "../examples/headless/panel.css";
import "../examples/headless/assistant.css";
import "../examples/headless/spotlight.css";
import "../examples/headless/inline.css";

function useHeadlessTour() {
  const tour = useRef<Driver | null>(null);

  useEffect(() => {
    return () => tour.current?.destroy();
  }, []);

  return (start: () => Driver) => {
    tour.current?.destroy();
    tour.current = start();
  };
}

export function PanelDemo() {
  const panel = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);
  const run = useHeadlessTour();

  function onStart() {
    setKey(current => current + 1);
    window.setTimeout(() => run(() => startPanelTour(panel.current!)));
  }

  const ui = (
    <div className={`${box} sm:flex-row sm:items-start`} key={key}>
      <div className="flex flex-1 flex-col gap-3">
        <button id="hp-new" type="button" className={`${secondary} w-fit`}>
          + New project
        </button>
        <input id="hp-name" className={field} placeholder="Project name" autoComplete="off" />
        <button id="hp-create" type="button" className={`${primary} w-fit`}>
          Create
        </button>
      </div>
      <div ref={panel} className="tour-panel">
        <p className="panel-count">Your guide shows up here.</p>
      </div>
    </div>
  );

  return <Frame ui={ui} onStart={onStart} />;
}

export function AssistantDemo() {
  const chat = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<"none" | "uploading" | "ready" | "shared">("none");
  const run = useHeadlessTour();

  function onStart() {
    setFile("none");
    run(() => {
      chat.current!.replaceChildren();
      return startAssistantTour(chat.current!);
    });
  }

  function upload() {
    setFile("uploading");
    window.setTimeout(() => setFile(current => (current === "uploading" ? "ready" : current)), 1500);
  }

  const ui = (
    <div className={`${box} sm:flex-row`}>
      <div className="flex flex-1 flex-col gap-3">
        <button id="ha-upload" type="button" className={`${secondary} w-fit`} onClick={upload}>
          Upload
        </button>
        {file === "uploading" && <span className="text-sm text-gray-500">report.pdf is uploading…</span>}
        {(file === "ready" || file === "shared") && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
            report.pdf
            <button id="ha-share" type="button" className={secondary} onClick={() => setFile("shared")}>
              Share
            </button>
          </div>
        )}
        {file === "shared" && (
          <button id="ha-copy" type="button" className={`${secondary} w-fit`}>
            Copy link
          </button>
        )}
      </div>
      <div ref={chat} className="chat sm:w-64" />
    </div>
  );

  return <Frame ui={ui} onStart={onStart} />;
}

export function SpotlightDemo() {
  const run = useHeadlessTour();
  const stat = "flex flex-col rounded-md border border-gray-200 px-4 py-3";

  const ui = (
    <div className={box}>
      <div className="flex flex-wrap gap-4">
        <div id="hs-visits" className={stat}>
          <span className="text-xs text-gray-500">Visits</span>
          <span className="text-2xl font-semibold">1,204</span>
        </div>
        <div id="hs-sales" className={stat}>
          <span className="text-xs text-gray-500">Sales</span>
          <span className="text-2xl font-semibold">$8,310</span>
        </div>
      </div>
      <svg id="hs-chart" viewBox="0 0 200 50" className="h-16 w-full max-w-sm">
        <polyline points="0,40 30,35 60,38 90,22 120,26 150,12 200,8" fill="none" stroke="#6366f1" strokeWidth="3" />
      </svg>
    </div>
  );

  return <Frame ui={ui} onStart={() => run(startSpotlightTour)} />;
}

export function InlineDemo() {
  const [key, setKey] = useState(0);
  const run = useHeadlessTour();

  function onStart() {
    setKey(current => current + 1);
    window.setTimeout(() => run(startInlineTour));
  }

  const ui = (
    <form className={box} key={key} onSubmit={event => event.preventDefault()}>
      <div className="field flex flex-col gap-1">
        <label htmlFor="hi-email" className="text-sm font-medium">
          Email
        </label>
        <input id="hi-email" type="email" required className={field} autoComplete="off" />
      </div>
      <div className="field flex flex-col gap-1">
        <label htmlFor="hi-password" className="text-sm font-medium">
          Password
        </label>
        <input id="hi-password" type="password" className={field} autoComplete="new-password" />
      </div>
      <div className="field flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input id="hi-terms" type="checkbox" /> I agree to the terms
        </label>
      </div>
      <button id="hi-submit" type="submit" className={`${primary} w-fit disabled:opacity-40`} disabled>
        Sign up
      </button>
    </form>
  );

  return <Frame ui={ui} onStart={onStart} />;
}
