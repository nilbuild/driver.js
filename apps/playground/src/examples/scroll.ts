import { driver } from "driver.js";
import type { ExampleGroup } from "./types";
import { basicTourSteps } from "./shared";

// Both examples run the same tour; only `allowScroll` differs so the page's
// scrollability during the tour can be compared directly.
function tourWithScroll(allowScroll: boolean) {
  driver({
    allowScroll,
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    steps: basicTourSteps,
  }).drive();
}

export const scrollGroup: ExampleGroup = {
  title: "Body Scrolling (test)",
  examples: [
    {
      id: "scroll-allowed",
      title: "Scroll Allowed (default)",
      description: "LOOK: while the tour is active you can still scroll the page with the wheel or trackpad.",
      run() {
        tourWithScroll(true);
      },
    },
    {
      id: "scroll-locked",
      title: "Scroll Locked",
      description: "LOOK: with allowScroll:false the body is frozen — wheel and trackpad scrolling do nothing.",
      run() {
        tourWithScroll(false);
      },
    },
    {
      id: "scroll-inside-container",
      title: "Steps Inside a Scroll Box",
      description:
        "LOOK: every step is a paragraph inside the scrollable box. The box scrolls each one into view, down to the ninth and back up to the second.",
      run() {
        driver({
          showProgress: true,
          steps: [1, 5, 9, 2].map(index => ({
            element: `#scrollable-area p:nth-child(${index})`,
            popover: {
              title: `Paragraph ${index}`,
              description: "This paragraph should be fully visible inside the box.",
            },
          })),
        }).drive();
      },
    },
  ],
};
