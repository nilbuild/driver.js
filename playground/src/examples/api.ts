import { driver } from "driver.js";
import type { ExampleGroup } from "./types";
import { basicTourSteps } from "./shared";

export const apiGroup: ExampleGroup = {
  title: "API & Hooks",
  examples: [
    {
      id: "hooks",
      title: "Lifecycle Hooks",
      description: "Log every lifecycle hook to the console as elements are highlighted.",
      run() {
        const describe = (element?: Element) => element?.textContent?.slice(0, 10) || " - N/A -";

        const driverObj = driver({
          animate: true,
          onDeselected: (element, step) => console.log(`Deselected: ${describe(element)}\n${JSON.stringify(step)}`),
          onHighlightStarted: (element, step) =>
            console.log(`Highlight Started: ${describe(element)}\n${JSON.stringify(step)}`),
          onHighlighted: (element, step) => console.log(`Highlighted: ${describe(element)}\n${JSON.stringify(step)}`),
          onDestroyed: (element, step) => console.log(`Destroyed: ${describe(element)}\n${JSON.stringify(step)}`),
        });

        driverObj.highlight({
          element: "#hooks-list",
          popover: { title: "Hooks", description: "Open the console to follow each hook as it fires." },
        });

        window.setTimeout(() => {
          driverObj.highlight({
            popover: { title: "Popup Hook", description: "There is no element below this popover." },
          });
        }, 1000);

        window.setTimeout(() => {
          driverObj.highlight({
            element: "ul.feature-list",
            popover: { description: "Back to an element again." },
          });
        }, 2000);
      },
    },
    {
      id: "api-test",
      title: "API Test",
      description: "Read tour state (index, first/last step) inside onPopoverRender.",
      run() {
        const driverObj = driver({
          animate: true,
          steps: basicTourSteps,
          disableActiveInteraction: true,
          showProgress: true,
          progressText: "{{current}} of {{total}} done",
          onPopoverRender: popover => {
            popover.title.innerHTML = `${driverObj.getActiveIndex()} ${driverObj.hasNextStep() ? "Yes" : "No"} ${
              driverObj.hasPreviousStep() ? "Yes" : "No"
            }`;
            popover.description.innerHTML = `${driverObj.isFirstStep() ? "Yes" : "No"} ${
              driverObj.isLastStep() ? "Yes" : "No"
            }`;

            console.log(driverObj.getActiveIndex());
            console.log(driverObj.getActiveStep());
          },
        });

        driverObj.drive(4);
      },
    },
    {
      id: "is-active",
      title: "Is Active?",
      description: "Check whether a driver instance is currently active (uses an alert).",
      run() {
        alert(driver().isActive());
      },
    },
    {
      id: "activate-check",
      title: "Activate and Check",
      description: "Highlight, then report the active status before and after destroying.",
      run() {
        const driverObj = driver({ showButtons: [] });

        driverObj.highlight({
          element: "#card-1",
          popover: {
            title: "Check if driver is active",
            description: "This will alert the status after 2 seconds.",
            side: "bottom",
            align: "start",
          },
        });

        setTimeout(() => {
          alert(`Status: ${driverObj.isActive()}. Destroying driver...`);
          driverObj.destroy();
          setTimeout(() => alert(`Status: ${driverObj.isActive()}`), 0);
        }, 2000);
      },
    },
    {
      id: "destroy",
      title: "Destroy",
      description: "Tear down any active driver instance.",
      run() {
        driver().destroy();
      },
    },
  ],
};
