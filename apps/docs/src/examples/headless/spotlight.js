import { driver } from "driver.js/headless";

const steps = [
  { element: "#hs-visits", data: { text: "Visits, live." } },
  { element: "#hs-sales", data: { text: "Sales this week." } },
  { element: "#hs-chart", data: { text: "Your trend at a glance." } },
];

export function startSpotlightTour() {
  const ring = document.createElement("div");
  ring.className = "spot-ring";
  const note = document.createElement("div");
  note.className = "spot-note";
  note.innerHTML = `
    <p></p>
    <small></small>
    <button data-go="back">Back</button>
    <button data-go="next">Next</button>
  `;
  document.body.append(ring, note);

  const [text, count, back, next] = note.children;

  const tour = driver({
    steps,
    onHighlighted: (element, step, opts) => {
      element.scrollIntoView({ block: "nearest" });
      place();

      text.textContent = step.data.text;
      count.textContent = `${opts.index + 1} / ${steps.length}`;
      back.hidden = opts.driver.isFirstStep();
      next.textContent = opts.driver.isLastStep() ? "Done" : "Next";
    },
    onDestroyed: () => {
      listeners.abort();
      ring.remove();
      note.remove();
    },
  });

  function place() {
    const target = tour.getActiveElement();
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    ring.style.translate = `${rect.left - 8}px ${rect.top - 8}px`;
    ring.style.width = `${rect.width + 16}px`;
    ring.style.height = `${rect.height + 16}px`;
    note.style.translate = `${rect.left}px ${rect.bottom + 18}px`;
  }

  const listeners = new AbortController();
  const { signal } = listeners;
  window.addEventListener("scroll", place, { capture: true, signal });
  window.addEventListener("resize", place, { signal });

  back.addEventListener("click", () => tour.movePrevious());
  next.addEventListener("click", () => tour.moveNext());

  window.addEventListener(
    "keydown",
    event => {
      const isTyping = event.target.closest?.("input, textarea, select");
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowRight") {
        tour.moveNext();
      } else if (event.key === "ArrowLeft" && !tour.isFirstStep()) {
        tour.movePrevious();
      } else if (event.key === "Escape") {
        tour.destroy();
      }
    },
    { signal }
  );

  tour.drive();
  return tour;
}
