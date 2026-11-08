import { driver, type Config, type DriveStep } from "driver.js";
import type { ExampleGroup } from "./types";

type Cleanup = () => void;

function mountFileManager(): Cleanup {
  const header = document.querySelector(".page-header");
  const panel = document.createElement("div");
  panel.id = "demo-files";
  panel.className = "my-6 rounded-md border border-gray-300 p-3";
  panel.innerHTML = `
    <p class="!mb-2 text-sm text-gray-500">Files</p>
    <div id="demo-file" tabindex="0" class="flex items-center gap-2 rounded px-2 py-1.5 outline-offset-2">
      <span aria-hidden="true">📄</span><span class="demo-file-name">report.pdf</span>
    </div>
  `;
  header?.after(panel);

  const file = panel.querySelector<HTMLElement>("#demo-file")!;
  const nameEl = panel.querySelector<HTMLElement>(".demo-file-name")!;
  let menu: HTMLElement | undefined;

  const closeMenu = (restoreFocus = false) => {
    menu?.remove();
    menu = undefined;
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    if (restoreFocus) {
      file.focus();
    }
  };

  const onOutsidePointer = (event: PointerEvent) => {
    if (menu && !menu.contains(event.target as Node)) {
      closeMenu();
    }
  };

  const startRename = () => {
    closeMenu();
    const input = document.createElement("input");
    input.id = "demo-rename-input";
    input.value = nameEl.textContent || "";
    input.className = "rounded border border-gray-400 px-1";
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && input.value.trim()) {
        nameEl.textContent = input.value.trim();
        input.replaceWith(nameEl);
        file.focus();
      }

      if (event.key === "Escape") {
        input.replaceWith(nameEl);
        file.focus();
      }
    });
  };

  const openMenu = (x: number, y: number) => {
    closeMenu();
    menu = document.createElement("div");
    menu.className = "demo-menu";
    menu.setAttribute("role", "menu");
    Object.assign(menu.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      zIndex: "50",
      background: "white",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      boxShadow: "0 8px 24px rgba(0,0,0,.15)",
      padding: "4px",
      minWidth: "140px",
    });
    menu.innerHTML = `
      <button type="button" role="menuitem" data-action="rename" class="block w-full rounded px-3 py-1.5 text-left hover:bg-gray-100">Rename</button>
      <button type="button" role="menuitem" data-action="delete" class="block w-full rounded px-3 py-1.5 text-left hover:bg-gray-100">Delete</button>
    `;
    document.body.appendChild(menu);
    menu.querySelector<HTMLElement>("[role=menuitem]")?.focus();

    menu.addEventListener("click", event => {
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "rename") {
        startRename();
      } else if (action === "delete") {
        closeMenu(true);
      }
    });

    menu.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    });

    document.addEventListener("pointerdown", onOutsidePointer, true);
  };

  file.addEventListener("contextmenu", event => {
    event.preventDefault();
    const rect = file.getBoundingClientRect();
    const fromKeyboard = event.button !== 2 && event.clientX === 0 && event.clientY === 0;
    openMenu(fromKeyboard ? rect.left + 24 : event.clientX, fromKeyboard ? rect.bottom : event.clientY);
  });

  return () => {
    closeMenu();
    panel.remove();
  };
}

const actionTourConfig: Config = {
  showButtons: ["close"],
  allowKeyboardControl: false,
  overlayClickBehavior: "none",

  onInteraction: (_element, step, opts) => {
    const { event, region } = opts;
    if (event.type === "keydown") {
      return;
    }

    const isWrongHere = region === "element" && step.data?.reject?.includes(event.type);
    if (region !== "outside" && !isWrongHere) {
      return;
    }

    opts.driver.updatePopover({ description: step.data?.hint });
    opts.driver.nudge();
    return false;
  },

  onElementMissing: (_element, step, opts) => {
    if (opts.cause === "timeout") {
      opts.driver.updatePopover({ description: "That is taking longer than expected. Try again." });
      return;
    }

    opts.driver.moveTo(step.data?.backTo ?? 0);
    opts.driver.updatePopover({ description: step.data?.lostHint });
  },
};

const renameSteps: DriveStep[] = [
  {
    element: "#demo-file",
    advanceOn: "contextmenu",
    allowedElements: ".demo-menu",
    data: {
      reject: ["click", "dblclick"],
      hint: "Not quite. Right-click the file, or focus it and press Shift+F10.",
    },
    popover: { title: "Open the menu", description: "Right-click <b>report.pdf</b>.", side: "bottom", align: "start" },
  },
  {
    element: ".demo-menu [data-action=rename]",
    waitForElement: 1500,
    advanceOn: "click",
    allowedElements: [".demo-menu", "#demo-file"],
    data: {
      reject: ["contextmenu"],
      hint: "Pick <b>Rename</b> from the menu.",
      backTo: 0,
      lostHint: "The menu closed. Right-click the file to open it again.",
    },
    popover: { title: "Choose Rename", description: "Click <b>Rename</b>.", side: "right", align: "start" },
  },
  {
    element: "#demo-rename-input",
    waitForElement: 1500,
    advanceOn: (element, _step, opts) => {
      element?.addEventListener(
        "keydown",
        event => {
          const input = element as HTMLInputElement;
          if ((event as KeyboardEvent).key === "Enter" && input.value.trim() && input.value !== "report.pdf") {
            opts.next();
          }
        },
        { signal: opts.signal }
      );
    },
    data: {
      hint: "Type a new name, then press Enter.",
      backTo: 0,
      lostHint: "Renaming was cancelled. Start again by right-clicking the file.",
    },
    popover: {
      title: "Name it",
      description: "Type a new name and press <b>Enter</b>.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#demo-file",
    popover: {
      title: "Renamed",
      description: "Every step only moved on when you did the real thing.",
      showButtons: ["next"],
      doneBtnText: "Finish",
    },
  },
];

export const actionDrivenGroup: ExampleGroup = {
  title: "Action-Driven",
  examples: [
    {
      id: "action-driven-rename",
      title: "Guided Rename",
      description:
        "Each step waits for the real action: right-click, pick Rename, type and press Enter. Wrong clicks get a hint and a nudge, and closing the menu sends you back a step.",
      run() {
        const cleanup = mountFileManager();
        driver({ ...actionTourConfig, steps: renameSteps, onDestroyed: cleanup }).drive();
      },
    },
    {
      id: "action-driven-feedback",
      title: "Wrong-Action Feedback",
      description:
        "Double-click the highlighted card. Single clicks pass through, a right-click or a click elsewhere is blocked, updates the text and nudges.",
      run() {
        let attempts = 0;
        const d = driver({
          showButtons: ["close"],
          overlayClickBehavior: "none",
          steps: [
            {
              element: "#card-1",
              advanceOn: "dblclick",
              popover: { title: "Double-click", description: "Double-click <b>Card One</b>." },
              onInteraction: (_element, _step, opts) => {
                const isOutside = opts.region === "outside";
                const isRightClick = opts.event.type === "contextmenu";
                if (!isOutside && !isRightClick) {
                  return;
                }

                attempts += 1;
                d.updatePopover({
                  title: `Not that (${attempts})`,
                  description: isRightClick ? "That was a right-click. Double-click instead." : "Stay on Card One.",
                });
                d.nudge();
                return false;
              },
            },
            {
              element: "#card-1",
              popover: {
                title: "Got it",
                description: "The step completed on the double-click.",
                showButtons: ["next"],
              },
            },
          ],
        });
        d.drive();
      },
    },
    {
      id: "action-driven-wait",
      title: "Waiting and Retry",
      description:
        "The first click loads slowly and the wait times out; the tour keeps you on the step with a hint. Click again and it moves on.",
      run() {
        let loads = 0;
        const button = document.querySelector<HTMLElement>("#card-2")!;
        const load = () => {
          loads += 1;
          const delay = loads === 1 ? 2500 : 300;
          window.setTimeout(() => {
            if (document.getElementById("demo-loaded")) {
              return;
            }

            const result = document.createElement("p");
            result.id = "demo-loaded";
            result.textContent = "Loaded content";
            result.className = "rounded border border-gray-300 p-2";
            document.querySelector(".buttons")?.after(result);
          }, delay);
        };
        button.addEventListener("click", load);

        driver({
          showButtons: ["close"],
          onElementMissing: (_element, _step, opts) => {
            opts.driver.updatePopover({ description: "Still loading. Click <b>Card Two</b> again." });
            opts.driver.nudge("popover");
          },
          onDestroyed: () => {
            button.removeEventListener("click", load);
            document.getElementById("demo-loaded")?.remove();
          },
          steps: [
            {
              element: "#card-2",
              advanceOn: "click",
              popover: { title: "Load", description: "Click <b>Card Two</b> to load content." },
            },
            {
              element: "#demo-loaded",
              waitForElement: 1500,
              popover: { title: "Loaded", description: "Here it is.", showButtons: ["next"] },
            },
          ],
        }).drive();
      },
    },
  ],
};
