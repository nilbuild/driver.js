import type { Config, DriveStep, PopoverDOM } from "driver.js";
import { driver } from "driver.js";
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
  firstButton.innerText = "Go to First";
  popover.footerButtons.appendChild(firstButton);

  firstButton.addEventListener("click", () => {
    window.driverObj.drive(0);
  });
}

export function CodeSample(props: CodeSampleProps) {
  const { heading, id, children, buttonText = "Show me an Example", className, config, highlight, tour } = props;

  if (id === "demo-hook-theme") {
    config!.onPopoverRender = attachFirstButton;
  }

  function onClick() {
    if (highlight) {
      const driverObj = driver({
        ...config,
      });

      window.driverObj = driverObj;
      driverObj.highlight(highlight);
    } else if (tour) {
      if (id === "confirm-destroy") {
        config!.onDestroyStarted = () => {
          if (!driverObj.hasNextStep() || confirm("Are you sure?")) {
            driverObj.destroy();
          }
        };
      }

      if (id === "logger-events") {
        config!.onNextClick = () => {
          console.log("next clicked");
        };

        config!.onNextClick = () => {
          console.log("Next Button Clicked");
          // Implement your own functionality here
          driverObj.moveNext();
        };
        config!.onPrevClick = () => {
          console.log("Previous Button Clicked");
          // Implement your own functionality here
          driverObj.movePrevious();
        };
        config!.onCloseClick = () => {
          console.log("Close Button Clicked");
          // Implement your own functionality here
          driverObj.destroy();
        };
      }

      if (tour?.[2]?.popover?.title === "Next Step is Async") {
        tour[2].popover.onNextClick = () => {
          mountDummyElement();
          driverObj.moveNext();
        };

        if (tour?.[3]?.element === ".dynamic-el") {
          tour[3].onDeselected = () => {
            removeDummyElement();
          };

          // @ts-ignore
          tour[4].popover.onPrevClick = () => {
            mountDummyElement();
            driverObj.movePrevious();
          };

          // @ts-ignore
          tour[3].popover.onPrevClick = () => {
            removeDummyElement();
            driverObj.movePrevious();
          };
        }
      }

      const driverObj = driver({
        ...config,
        steps: tour,
      });

      window.driverObj = driverObj;
      driverObj.drive();
    }
  }

  return (
    <div id={id} className={className}>
      {heading && <p className="text-lg -mt-0 font-medium text-black -mb-3 rounded-md">{heading}</p>}
      {children && <div className="-mb-4">{children}</div>}
      <button onClick={onClick} className="w-full rounded-md bg-black p-2 text-white">
        {buttonText}
      </button>
    </div>
  );
}
