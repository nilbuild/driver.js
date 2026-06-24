import { driver } from "driver.js";
import type { ExampleGroup } from "./types";
import { basicTourSteps } from "./shared";

// Each example runs the same tour at a different `duration` so the effect on
// both the stage slide and the fade-in can be eyeballed side by side.
function tourWithDuration(duration: number) {
  driver({
    duration,
    showProgress: true,
    showButtons: ["next", "previous", "close"],
    steps: basicTourSteps,
  }).drive();
}

export const durationGroup: ExampleGroup = {
  title: "Animation Duration (test)",
  examples: [
    {
      id: "duration-fast",
      title: "Fast (150ms)",
      description: "LOOK: the spotlight snaps between steps and the popover fades in almost instantly.",
      run() {
        tourWithDuration(150);
      },
    },
    {
      id: "duration-default",
      title: "Default (400ms)",
      description: "LOOK: the default speed — slide and fade-in both run over 400ms.",
      run() {
        tourWithDuration(400);
      },
    },
    {
      id: "duration-slow",
      title: "Slow (1200ms)",
      description: "LOOK: the hole glides slowly and the popover fade-in is clearly visible.",
      run() {
        tourWithDuration(1200);
      },
    },
    {
      id: "duration-very-slow",
      title: "Very Slow (2500ms)",
      description: "LOOK: an exaggerated transition — useful for confirming slide and fade stay in sync.",
      run() {
        tourWithDuration(2500);
      },
    },
  ],
};
