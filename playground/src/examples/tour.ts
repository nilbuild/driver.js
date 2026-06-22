import { driver } from "driver.js";
import type { ExampleGroup } from "./types";
import { basicTourSteps } from "./shared";

export const tourGroup: ExampleGroup = {
  title: "Tour",
  examples: [
    {
      id: "animated-tour",
      title: "Animated Tour",
      description: "A multi-step tour with progress and navigation buttons.",
      run() {
        driver({
          showProgress: true,
          showButtons: ["next", "previous", "close"],
          steps: basicTourSteps,
        }).drive();
      },
    },
    {
      id: "non-animated-tour",
      title: "Non-Animated Tour",
      description: "The same tour with animation disabled and a tinted overlay.",
      run() {
        driver({
          animate: false,
          overlayColor: "blue",
          overlayOpacity: 0.3,
          showProgress: true,
          steps: basicTourSteps,
        }).drive();
      },
    },
    {
      id: "async-tour",
      title: "Asynchronous Tour",
      description: "Control the tour flow and create elements on the fly via onNextClick.",
      run() {
        const driverObj = driver({
          animate: true,
          overlayOpacity: 0.3,
          showProgress: true,
          progressText: "{{current}} / {{total}}",
          steps: [
            {
              element: ".page-header",
              popover: {
                title: "Async Driver.js",
                description: "Override `onNextClick` to take full control over when the tour advances.",
                side: "bottom",
                align: "start",
              },
            },
            {
              element: ".page-header h1",
              popover: {
                title: "Async Test",
                description: "By overriding `onNextClick` you get control over the tour.",
                side: "left",
                align: "start",
                onNextClick: () => {
                  const newDiv = document.querySelector<HTMLDivElement>(".dynamic-el") || document.createElement("div");

                  newDiv.innerHTML = "This is a new Element";
                  newDiv.style.display = "block";
                  newDiv.style.padding = "20px";
                  newDiv.style.backgroundColor = "black";
                  newDiv.style.color = "white";
                  newDiv.style.fontSize = "14px";
                  newDiv.style.position = "fixed";
                  newDiv.style.top = `${Math.random() * (500 - 30) + 30}px`;
                  newDiv.style.left = `${Math.random() * (500 - 30) + 30}px`;
                  newDiv.className = "dynamic-el";

                  document.body.appendChild(newDiv);

                  driverObj.moveNext();
                },
              },
            },
            {
              element: ".dynamic-el",
              onDeselected: element => {
                element?.parentElement?.removeChild(element);
              },
              popover: {
                title: "Dynamic Elements",
                description: "This element was created right before we moved here.",
              },
            },
            {
              element: ".page-header sup",
              popover: {
                title: "Improved Hooks",
                description: "Hooks let you run logic before and after each step is highlighted.",
                side: "bottom",
                align: "start",
              },
            },
            {
              popover: {
                title: "No Element",
                description: "You can now have popovers without elements as well.",
              },
            },
            {
              element: "#scrollable-area",
              popover: {
                title: "Scrollable Areas",
                description: "There are no issues with scrollable element tours either.",
              },
            },
            {
              element: "#third-scroll-paragraph",
              popover: {
                title: "Nested Scrolls",
                description: "Even nested scrollable elements work.",
              },
            },
          ],
        });

        driverObj.drive();
      },
    },
    {
      id: "confirm-exit-tour",
      title: "Confirm on Exit",
      description: "Ask for confirmation before the tour is destroyed.",
      run() {
        const driverObj = driver({
          animate: true,
          overlayColor: "green",
          overlayOpacity: 0.3,
          steps: basicTourSteps,
          onDestroyStarted: () => {
            if (driverObj.hasNextStep() && confirm("Are you sure?")) {
              driverObj.destroy();
            } else {
              driverObj.destroy();
            }
          },
        });

        driverObj.drive();
      },
    },
    {
      id: "progress-tour",
      title: "Progress Text",
      description: "Show the default progress indicator.",
      run() {
        driver({ animate: true, steps: basicTourSteps, showProgress: true }).drive();
      },
    },
    {
      id: "progress-tour-template",
      title: "Progress Text Template",
      description: "Customise the progress text template.",
      run() {
        driver({
          animate: true,
          steps: basicTourSteps,
          showProgress: true,
          progressText: "{{current}} of {{total}} done",
        }).drive();
      },
    },
    {
      id: "reconfigure-steps",
      title: "Re-Configuring Steps",
      description: "Replace the steps after the driver has been created.",
      run() {
        const driverObj = driver({ animate: true, steps: basicTourSteps, showProgress: true });

        driverObj.setSteps([
          { element: "h1", popover: { description: "This is a new description" } },
          { element: "p", popover: { description: "This is another new description" } },
        ]);

        driverObj.drive();
      },
    },
    {
      id: "disable-keyboard-control",
      title: "Disable Keyboard Control",
      description: "Turn off arrow-key and escape navigation.",
      run() {
        const driverObj = driver({
          animate: true,
          steps: basicTourSteps,
          showProgress: true,
          allowKeyboardControl: false,
        });

        driverObj.setSteps([
          { element: "h1", popover: { description: "This is a new description" } },
          { element: "p", popover: { description: "This is another new description" } },
        ]);

        driverObj.drive();
      },
    },
    {
      id: "tour-button-listeners",
      title: "Tour Button Listeners",
      description: "Drive the tour manually from global button listeners (uses alerts).",
      run() {
        const driverObj = driver({
          onNextClick: () => {
            alert("Next Clicked");
            driverObj.moveNext();
          },
          onPrevClick: () => {
            alert("Previous Clicked");
            driverObj.movePrevious();
          },
          onCloseClick: () => driverObj.destroy(),
          steps: [
            { popover: { title: "Some title", description: "Some description" } },
            { popover: { title: "Another title", description: "Some description" } },
            { popover: { title: "Yet another title", description: "Some description" } },
          ],
        });

        driverObj.drive();
      },
    },
    {
      id: "click-overlay-to-next",
      title: "Click Overlay to Next",
      description: "Advance the tour when the overlay is clicked.",
      run() {
        driver({
          animate: true,
          overlayClickBehavior: "nextStep",
          steps: basicTourSteps,
        }).drive();
      },
    },
    {
      id: "click-overlay-to-handle",
      title: "Custom Overlay Click",
      description: "Handle overlay clicks with a custom callback.",
      run() {
        driver({
          animate: true,
          overlayClickBehavior: () => alert("Clicking me"),
          steps: basicTourSteps,
        }).drive();
      },
    },
  ],
};
