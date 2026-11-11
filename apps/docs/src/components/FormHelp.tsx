import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const fields = [
  { id: "name", title: "Name", description: "Your full name" },
  { id: "education", title: "Education", description: "Degree" },
  { id: "age", title: "Age", description: "In years" },
  { id: "address", title: "Address", description: "Street, city" },
];

export function FormHelp() {
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const driverObj = driver({
      popoverClass: "driverjs-theme",
      stagePadding: 0,
      onDestroyed: () => {
        (document.activeElement as HTMLElement | null)?.blur();
      },
    });

    fields.forEach(field => {
      const element = document.getElementById(field.id);
      if (!element) {
        return;
      }

      element.addEventListener(
        "focus",
        () => {
          driverObj.highlight({
            element,
            popover: { title: field.title, description: field.description },
          });
        },
        { signal }
      );
    });

    document.getElementById("submit-btn")?.addEventListener("focus", () => driverObj.destroy(), { signal });

    return () => {
      controller.abort();
      driverObj.destroy();
    };
  }, []);

  return null;
}
