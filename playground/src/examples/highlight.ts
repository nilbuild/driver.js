import { driver } from "driver.js";
import type { ExampleGroup } from "./types";

export const highlightGroup: ExampleGroup = {
  title: "Highlight",
  examples: [
    {
      id: "simple-highlight",
      title: "Simple Highlight",
      description: "Highlight a single element without animation.",
      run() {
        driver({ animate: false }).highlight({
          element: "#large-paragraph-text",
          popover: {
            title: "driver.js",
            description:
              "Highlight anything, anywhere on the page. Yes, literally anything including SVG portions and scrollable items.",
            align: "start",
            side: "top",
          },
        });
      },
    },
    {
      id: "animated-highlight",
      title: "Animated Highlight",
      description: "Highlight with animation and lifecycle hooks logged to the console.",
      run() {
        driver({
          animate: true,
          popoverOffset: 10,
          stagePadding: 10,
          onDeselected: (element, step) => console.log("Deselected element", element, step),
          onHighlightStarted: (element, step) => console.log("Started highlighting element", element, step),
          onHighlighted: (element, step) => console.log("Highlighted element", element, step),
        }).highlight({
          element: "h2",
          popover: {
            title: "MIT License",
            description: "A lightweight, no-dependency JavaScript engine to drive the user's focus.",
            side: "bottom",
            align: "start",
          },
        });
      },
    },
    {
      id: "transition-highlight",
      title: "Transition Highlight",
      description: "Re-highlight different elements to watch the popover transition between them.",
      run() {
        const driverObj = driver({
          animate: true,
          onDeselected: (element, step) => console.log("Deselected element", element, step),
          onHighlightStarted: (element, step) => console.log("Started highlighting element", element, step),
          onHighlighted: (element, step) => console.log("Highlighted element", element, step),
        });

        driverObj.highlight({
          popover: { title: "driver.js", description: "Highlight anything, anywhere on the page." },
        });

        window.setTimeout(() => {
          driverObj.highlight({
            element: ".buttons button:first-child",
            popover: { title: "driver.js", description: "Highlight anything, anywhere on the page." },
          });
        }, 2000);

        window.setTimeout(() => {
          driverObj.highlight({
            popover: { title: "driver.js", description: "Highlight anything, anywhere on the page." },
          });
        }, 4000);

        window.setTimeout(() => {
          driverObj.highlight({ element: "h2", popover: { description: "driver.js" } });
        }, 6000);
      },
    },
    {
      id: "off-screen-highlight",
      title: "Off Screen Highlight",
      description: "Highlight an element that is taller than the viewport.",
      run() {
        driver().highlight({
          element: ".demo-container",
          popover: {
            title: "Off Screen Highlight",
            description: "The page scrolls to bring partially off-screen elements into view automatically.",
            side: "bottom",
            align: "start",
          },
        });
      },
    },
    {
      id: "nested-highlight",
      title: "Nested Element Highlight",
      description: "Highlight a deeply nested inline element.",
      run() {
        driver().highlight({
          element: ".page-header h1 sup",
          popover: {
            title: "Nested Highlight",
            description: "Even tiny nested elements are highlighted precisely without z-index hacks.",
            side: "bottom",
            align: "start",
          },
        });
      },
    },
    {
      id: "dark-highlight",
      title: "Super Dark Highlight",
      description: "Increase the overlay opacity for a darker backdrop.",
      run() {
        driver({ animate: true, overlayOpacity: 0.9 }).highlight({ element: "ul.feature-list" });
      },
    },
    {
      id: "dim-highlight",
      title: "Super Dim Highlight",
      description: "Lower the overlay opacity for a subtle backdrop.",
      run() {
        driver({ animate: true, overlayOpacity: 0.2 }).highlight({ element: ".buttons" });
      },
    },
    {
      id: "backdrop-color",
      title: "Backdrop Color",
      description: "Tint the overlay with a custom colour.",
      run() {
        driver({ overlayColor: "blue", overlayOpacity: 0.3 }).highlight({ element: "#card-1" });
      },
    },
    {
      id: "scrollable-area",
      title: "Scrollable Area",
      description: "Highlight an element inside a scrollable container.",
      run() {
        driver({ animate: true }).highlight({ element: "#scrollable-area" });
      },
    },
    {
      id: "inner-scroll-area",
      title: "Inner Scroll Area",
      description: "Highlight a paragraph nested inside the scrollable container.",
      run() {
        driver({ animate: true }).highlight({ element: "#third-scroll-paragraph" });
      },
    },
    {
      id: "no-element",
      title: "No Element",
      description: "Show a popover that is not attached to any element.",
      run() {
        driver({
          animate: true,
          onDestroyed: (element, step) => console.log("Close modal", element, step),
          onDeselected: (element, step) => console.log("Deselected element", element, step),
          onHighlightStarted: (element, step) => console.log("Started highlighting element", element, step),
          onHighlighted: (element, step) => console.log("Highlighted element", element, step),
        }).highlight({
          popover: {
            showButtons: [],
            description:
              "<div class='gif-popover'><img style='max-width: 100%' src='https://i.imgur.com/EAQhHu5.gif' /><p>Go and build something cool!</p></div>",
          },
        });
      },
    },
    {
      id: "disallow-close",
      title: "Disallow Close",
      description: "Prevent the overlay click from closing the highlight.",
      run() {
        driver({ animate: true, allowClose: false }).highlight({ element: ".buttons" });
      },
    },
  ],
};
