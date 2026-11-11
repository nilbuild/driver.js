import type { Config, DriveStep, PopoverDOM } from "driver.js";
import { driver } from "driver.js";
import { useRef } from "react";
import "driver.js/dist/driver.css";
import { mountDummyElement, removeDummyElement } from "../lib/dummyElement";

type CodeSampleProps = {
  heading?: string;

  config?: Config;
  highlight?: DriveStep;
  tour?: DriveStep[];

  id?: string;
  className?: string;
  children?: any;
  buttonText?: string;
};

function attachFirstButton(popover: PopoverDOM) {
  const firstButton = document.createElement("button");
  firstButton.className = "driver-popover-footer-btn";
  firstButton.innerText = "Go to First";
  popover.footerButtons.appendChild(firstButton);

  firstButton.addEventListener("click", () => {
    window.driverObj.drive(0);
  });
}

export function CodeSample(props: CodeSampleProps) {
  const { heading, id, children, buttonText = "Show me an Example", className, config, highlight, tour } = props;

  const containerRef = useRef<HTMLDivElement>(null);

  // `.line` selectors point at this sample's own code block, not the first one
  // on the page, so several samples can share a page.
  function scopeToSample(step: DriveStep): DriveStep {
    const { element } = step;
    if (typeof element !== "string" || !element.startsWith(".line")) {
      return step;
    }

    return { ...step, element: () => containerRef.current?.querySelector(element) as Element };
  }

  // A scrolled code block would leave a highlighted line partly outside it.
  function resetCodeScroll() {
    document.querySelectorAll("pre").forEach(pre => {
      pre.scrollLeft = 0;
    });
  }

  function warnAboutWideLines(steps: DriveStep[]) {
    if (!import.meta.env.DEV) {
      return;
    }

    steps.forEach(step => {
      const element = typeof step.element === "function" ? step.element() : step.element;
      const target = typeof element === "string" ? document.querySelector(element) : element;
      const block = target?.closest("pre");
      if (!target || !block || target === block) {
        return;
      }

      if (target.getBoundingClientRect().right > block.getBoundingClientRect().right) {
        console.warn(`[docs] Highlighted code line is wider than its block: "${target.textContent}"`);
      }
    });
  }

  if (id === "demo-hook-theme") {
    config!.onPopoverRender = attachFirstButton;
  }

  function onClick() {
    resetCodeScroll();

    if (highlight) {
      const driverObj = driver({
        ...config,
      });

      window.driverObj = driverObj;
      driverObj.highlight(highlight);
    } else if (tour) {
      if (id === "confirm-destroy") {
        config!.onDestroyStarted = (element, step, { reason }) => {
          if (reason === "done" || confirm("Are you sure?")) {
            driverObj.destroy();
          }
        };
      }

      if (id === "destroy-reason") {
        config!.onDestroyed = (element, step, { reason, index }) => {
          driver().highlight({
            element: `#${id}`,
            popover: {
              title: reason === "done" ? "Tour finished" : `Left at step ${index! + 1} of ${tour.length}`,
              description: `onDestroyed received <code>reason: "${reason}"</code>.`,
              side: "top",
              align: "start",
            },
          });
        };
      }

      if (id === "logger-events") {
        config!.onNextClick = () => {
          console.log("Next clicked");
          driverObj.moveNext();
        };
        config!.onPrevClick = () => {
          console.log("Previous clicked");
          driverObj.movePrevious();
        };
        config!.onCloseClick = () => {
          console.log("Close clicked");
          driverObj.destroy();
        };
        config!.onDoneClick = () => {
          console.log("Done clicked");
          driverObj.destroy();
        };
      }

      if (id === "interactive-wait") {
        tour[0].popover!.onNextClick = () => {
          window.setTimeout(mountDummyElement, 800);
          driverObj.moveNext();
        };
        tour[1].onDeselected = () => removeDummyElement();
        config!.onDestroyed = () => removeDummyElement();
      }

      if (id === "async-tour") {
        tour[0].popover!.onNextClick = () => {
          mountDummyElement();
          driverObj.moveNext();
        };
        tour[1].onDeselected = () => removeDummyElement();
        tour[2].popover!.onPrevClick = () => {
          mountDummyElement();
          driverObj.movePrevious();
        };
      }

      const steps = tour.map(scopeToSample);
      warnAboutWideLines(steps);

      const driverObj = driver({
        ...config,
        steps,
      });

      window.driverObj = driverObj;
      driverObj.drive();
    }
  }

  return (
    <div id={id} className={className} ref={containerRef}>
      {heading && <p className="text-lg -mt-0 font-medium text-black -mb-3 rounded-md">{heading}</p>}
      {children && <div className="-mb-4">{children}</div>}
      <button onClick={onClick} className="w-full rounded-md bg-black p-2 text-white">
        {buttonText}
      </button>
    </div>
  );
}
