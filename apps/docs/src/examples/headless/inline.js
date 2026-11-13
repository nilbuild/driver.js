import { driver } from "driver.js/headless";

export function startInlineTour() {
  const hint = document.createElement("p");
  hint.className = "inline-hint";
  hint.id = "tour-hint";

  const tour = driver({
    steps: [
      {
        element: "#hi-email",
        advanceOn: {
          event: "change",
          when: element => element.checkValidity(),
        },
        data: { hint: "Your work email. Press Tab when you're done." },
      },
      {
        element: "#hi-password",
        advanceOn: {
          event: "input",
          when: element => element.value.length >= 8,
        },
        data: { hint: "At least 8 characters. Keep typing…" },
      },
      {
        element: "#hi-terms",
        advanceOn: {
          event: "change",
          when: element => element.checked,
        },
        data: { hint: "Tick this one and you're in." },
      },
    ],
    onHighlighted: (element, step) => {
      hint.textContent = step.data.hint;
      element.closest(".field").append(hint);
      element.setAttribute("aria-describedby", hint.id);
    },
    onDeselected: element => {
      element?.removeAttribute("aria-describedby");
    },
    onDestroyed: (element, step, opts) => {
      hint.remove();
      if (opts.reason === "done") {
        document.querySelector("#hi-submit").disabled = false;
      }
    },
  });

  tour.drive();
  return tour;
}
