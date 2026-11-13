import { driver } from "driver.js/headless";

const steps = [
  {
    element: "#hp-new",
    advanceOn: "click",
    data: { title: "Start a project" },
  },
  {
    element: "#hp-name",
    advanceOn: {
      event: "input",
      when: element => element.value.trim().length > 2,
    },
    data: { title: "Give it a name" },
  },
  {
    element: "#hp-create",
    advanceOn: "click",
    data: { title: "Create it" },
  },
];

export function startPanelTour(panel) {
  panel.setAttribute("aria-live", "polite");

  const tour = driver({
    steps,
    onHighlighted: (element, step, opts) => {
      element?.classList.add("is-guided");
      renderPanel(panel, opts.index);
    },
    onElementReplaced: element => {
      element.classList.add("is-guided");
    },
    onDeselected: element => {
      element?.classList.remove("is-guided");
    },
    onDestroyed: (element, step, opts) => {
      renderPanel(panel, opts.reason === "done" ? steps.length : -1);
    },
  });

  tour.drive();
  return tour;
}

function renderPanel(panel, current) {
  const done = Math.max(current, 0);
  const items = steps.map((step, index) => {
    const state = index < current ? "done" : index === current ? "current" : "";
    return `<li class="${state}">${step.data.title}</li>`;
  });

  panel.innerHTML = `
    <p class="panel-count">${done} of ${steps.length} done</p>
    <div class="panel-bar" style="--done: ${done / steps.length}"></div>
    <ol>${items.join("")}</ol>
  `;
}
