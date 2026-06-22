import type { DriveStep } from "driver.js";

// Reused across the tour examples so they stay in sync. Targets elements that
// live in the shared <Stage /> component.
export const basicTourSteps: DriveStep[] = [
  {
    element: ".page-header",
    popover: {
      title: "Driver.js",
      description: "A powerful, highly customisable and dependency-free way to drive the user's focus across the page.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".page-header h1",
    popover: {
      title: "No Stacking Issues",
      description: "The popover is positioned without juggling z-indexes, so there are no positional surprises.",
      side: "left",
      align: "start",
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
      description: "You can have popovers without elements as well — handy for intros and outros.",
    },
  },
  {
    element: ".buttons",
    popover: {
      title: "Buttons",
      description: "Here are some buttons to highlight as a group.",
    },
  },
  {
    element: "#scrollable-area",
    popover: {
      title: "Scrollable Areas",
      description: "Tours through scrollable elements work without any extra configuration.",
    },
  },
  {
    element: "#third-scroll-paragraph",
    popover: {
      title: "Nested Scrolls",
      description: "Even nested scrollable elements are brought into view.",
    },
  },
];
