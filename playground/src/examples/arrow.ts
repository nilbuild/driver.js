import { driver } from "driver.js";
import type { ExampleGroup } from "./types";

// A focused set of scenarios for verifying the rewritten arrow/position logic.
// Each description says what to LOOK FOR so the behavior can be eyeballed.
export const arrowGroup: ExampleGroup = {
  title: "Arrow Positioning (test)",
  examples: [
    {
      id: "arrow-default-side",
      title: "Default Side",
      description: "No side set. LOOK: popover renders BELOW the card (new default is bottom, was left).",
      run() {
        driver().highlight({
          element: "#card-3",
          popover: {
            title: "Default Side",
            description: "No `side` was passed. It should appear below the element with the arrow pointing up at it.",
          },
        });
      },
    },
    {
      id: "arrow-tall-left-start",
      title: "Tall Element · Left · Start",
      description: "Element far taller than the popover. LOOK: arrow sits near the TOP of the popover.",
      run() {
        driver().highlight({
          element: ".demo-container",
          popover: {
            title: "Tall · Left · Start",
            description: "The element spans the whole popover edge, so align=start parks the arrow at the top.",
            side: "left",
            align: "start",
          },
        });
      },
    },
    {
      id: "arrow-tall-left-center",
      title: "Tall Element · Left · Center",
      description: "Same tall element. LOOK: arrow is vertically CENTERED on the popover (the off-screen fix).",
      run() {
        driver().highlight({
          element: ".demo-container",
          popover: {
            title: "Tall · Left · Center",
            description: "Previously the arrow was jammed into a corner; it should now be centered.",
            side: "left",
            align: "center",
          },
        });
      },
    },
    {
      id: "arrow-tall-left-end",
      title: "Tall Element · Left · End",
      description: "Same tall element. LOOK: arrow sits near the BOTTOM of the popover.",
      run() {
        driver().highlight({
          element: ".demo-container",
          popover: {
            title: "Tall · Left · End",
            description: "align=end parks the arrow at the bottom inset.",
            side: "left",
            align: "end",
          },
        });
      },
    },
    {
      id: "arrow-small-left",
      title: "Small Element · Left · Center",
      description: "Small button, tall popover. LOOK: arrow points right AT the button's vertical center, not the popover's.",
      run() {
        driver().highlight({
          element: "#card-3",
          popover: {
            title: "Small · Left",
            description:
              "Because the element does not span the popover, align is ignored and the arrow tracks the element.",
            side: "left",
            align: "center",
          },
        });
      },
    },
    {
      id: "arrow-wide-bottom-start",
      title: "Wide Element · Bottom · Start",
      description: "Wide header, narrower popover. LOOK: arrow near the LEFT of the popover.",
      run() {
        driver().highlight({
          element: ".page-header",
          popover: {
            title: "Wide · Bottom · Start",
            description: "The element spans the whole popover edge horizontally, so align=start pins the arrow left.",
            side: "bottom",
            align: "start",
          },
        });
      },
    },
    {
      id: "arrow-wide-bottom-center",
      title: "Wide Element · Bottom · Center",
      description: "Same wide header. LOOK: arrow CENTERED horizontally under the popover.",
      run() {
        driver().highlight({
          element: ".page-header",
          popover: {
            title: "Wide · Bottom · Center",
            description: "align=center centers the arrow along the popover edge.",
            side: "bottom",
            align: "center",
          },
        });
      },
    },
    {
      id: "arrow-wide-bottom-end",
      title: "Wide Element · Bottom · End",
      description: "Same wide header. LOOK: arrow near the RIGHT of the popover.",
      run() {
        driver().highlight({
          element: ".page-header",
          popover: {
            title: "Wide · Bottom · End",
            description: "align=end pins the arrow to the right.",
            side: "bottom",
            align: "end",
          },
        });
      },
    },
    {
      id: "arrow-right-end",
      title: "Small Element · Right · End",
      description: "LOOK: popover on the RIGHT of the card, arrow on its left edge pointing at the card.",
      run() {
        driver().highlight({
          element: "#card-2",
          popover: {
            title: "Right · End",
            description: "Checks the right-edge arrow and that it stays attached and points back at the element.",
            side: "right",
            align: "end",
          },
        });
      },
    },
    {
      id: "arrow-padding-bottom",
      title: "Stage Padding · Bottom",
      description: "stagePadding + offset set. LOOK: clean gap between element and popover, arrow connects (no double-nudge).",
      run() {
        driver({ stagePadding: 10, popoverOffset: 10 }).highlight({
          element: "#card-3",
          popover: {
            title: "Padding · Bottom",
            description: "Verifies the removed translateY hack didn't break bottom-side spacing.",
            side: "bottom",
            align: "center",
          },
        });
      },
    },
    {
      id: "arrow-flip-top",
      title: "Forced Top · Flips",
      description: "Asks for side=top on the header (no room above). LOOK: popover flips BELOW, arrow points up.",
      run() {
        driver().highlight({
          element: ".page-header",
          popover: {
            title: "Flip Test",
            description: "There is no room above the header, so it should flip to bottom and the arrow should follow.",
            side: "top",
            align: "center",
          },
        });
      },
    },
    {
      id: "arrow-over-no-element",
      title: "No Element (over)",
      description: "No element. LOOK: popover centered on screen like a modal, with NO arrow.",
      run() {
        driver().highlight({
          popover: {
            title: "Centered Modal",
            description: "With no target element the popover centers itself and the arrow is hidden.",
          },
        });
      },
    },
  ],
};
