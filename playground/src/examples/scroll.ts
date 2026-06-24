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
  ],
};
