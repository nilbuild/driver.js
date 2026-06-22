import { driver } from "driver.js";
import type { ExampleGroup } from "./types";

export const popoverGroup: ExampleGroup = {
  title: "Popover & Buttons",
  examples: [
    {
      id: "no-buttons",
      title: "No Buttons",
      description: "Highlight shows no buttons by default.",
      run() {
        driver().highlight({
          element: "#card-1",
          popover: {
            title: "No Buttons",
            description: "No buttons are shown by default for a highlight. Opt into the ones you want.",
          },
        });
      },
    },
    {
      id: "selected-buttons",
      title: "Selected Buttons",
      description: "Choose which buttons appear via the popover config.",
      run() {
        driver().highlight({
          element: "#card-2",
          popover: {
            title: "Close Only",
            showButtons: ["close"],
            description: "Pass `showButtons` on the popover to display only the buttons you need.",
          },
        });
      },
    },
    {
      id: "next-button",
      title: "Next Button",
      description: "Show only the next and close buttons.",
      run() {
        const driverObj = driver();
        driverObj.highlight({
          element: "#card-3",
          popover: {
            title: "Next and Close",
            showButtons: ["close", "next"],
            description: "This one only has next and close buttons, nothing else.",
            onNextClick: (step, element, opts) => {
              console.log("Next Clicked", step, element, opts);
              opts.driver.destroy();
            },
          },
        });
      },
    },
    {
      id: "previous-button",
      title: "Previous Button",
      description: "Show only the previous and close buttons.",
      run() {
        driver().highlight({
          element: "#card-4",
          popover: {
            title: "Previous and Close",
            showButtons: ["close", "previous"],
            description: "This one only has previous and close buttons, nothing else.",
          },
        });
      },
    },
    {
      id: "next-prev-button",
      title: "Next & Previous",
      description: "Show the next and previous buttons together.",
      run() {
        driver().highlight({
          element: "#card-5",
          popover: {
            title: "Next and Previous Only",
            showButtons: ["next", "previous"],
            description: "This one only has next and previous buttons.",
          },
        });
      },
    },
    {
      id: "close-button",
      title: "Close Button",
      description: "Show only the close button.",
      run() {
        driver().highlight({
          element: "#card-6",
          popover: {
            title: "Close Only",
            showButtons: ["close"],
            description: "This one only has the close button.",
          },
        });
      },
    },
    {
      id: "button-texts",
      title: "Button Texts",
      description: "Override the button labels from config and popover.",
      run() {
        driver({ prevBtnText: "<——", nextBtnText: "——>" }).highlight({
          element: "#card-1",
          popover: {
            side: "left",
            title: "Custom Button Text",
            showButtons: ["close", "next", "previous"],
            nextBtnText: "==>",
            prevBtnText: "<==",
            description: "These button labels are configured on the popover.",
          },
        });
      },
    },
    {
      id: "disabled-buttons",
      title: "Disabled Buttons",
      description: "Selectively disable individual buttons.",
      run() {
        driver().highlight({
          element: "#card-2",
          popover: {
            title: "Disabled Buttons",
            description: "You can selectively disable buttons as well.",
            showButtons: ["next", "previous", "close"],
            disableButtons: ["next", "previous"],
          },
        });
      },
    },
    {
      id: "button-listeners",
      title: "Button Listeners",
      description: "Listen to button clicks globally (uses alerts).",
      run() {
        const driverObj = driver({
          onNextClick: () => alert("Next Clicked"),
          onPrevClick: () => alert("Previous Clicked"),
          onCloseClick: () => driverObj.destroy(),
        });

        driverObj.highlight({
          popover: {
            title: "Global Button Listener",
            description: "You can listen to the button clicks globally.",
            showButtons: ["close", "next", "previous"],
            onPrevClick: () => alert("Overriding — Previous Clicked"),
          },
        });
      },
    },
    {
      id: "custom-classes",
      title: "Custom Classes",
      description: "Apply a custom class to style the popover.",
      run() {
        driver({ popoverClass: "custom-driver-popover" }).highlight({
          popover: {
            popoverClass: "custom-driver-popover",
            title: "Custom Classes",
            description: "The popover and its buttons use custom classes for styling.",
            showButtons: ["close", "next", "previous"],
          },
        });
      },
    },
    {
      id: "popover-hook",
      title: "Popover Hook",
      description: "Modify the popover in the onPopoverRender hook.",
      run() {
        driver({
          onPopoverRender: popover => {
            popover.title.innerText = "Modified Parent";
          },
        }).highlight({
          element: ".page-header",
          popover: {
            title: "Page Title",
            description: "The title is rewritten in the render hook.",
            side: "bottom",
            align: "start",
            onPopoverRender: popover => {
              popover.title.innerText = "Modified";
            },
          },
        });
      },
    },
    {
      id: "popover-custom-button",
      title: "Custom Footer Button",
      description: "Append a custom button to the popover footer.",
      run() {
        const driverObj = driver({
          onPopoverRender: popover => {
            const firstButton = document.createElement("button");
            firstButton.innerText = "First";
            popover.footerButtons.appendChild(firstButton);
            firstButton.addEventListener("click", () => console.log("First Button Clicked"));
          },
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
      id: "padding-change",
      title: "Padding & Radius",
      description: "Tweak the stage padding, radius and popover offset.",
      run() {
        driver({ stagePadding: 0, popoverOffset: 20, stageRadius: 10 }).highlight({
          element: "#card-3",
          popover: {
            title: "Padding & Radius",
            description: "The stage padding, radius and popover offset are all customised here.",
            side: "bottom",
            align: "start",
          },
        });
      },
    },
  ],
};
