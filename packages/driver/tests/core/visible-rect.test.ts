import { afterEach, describe, expect, it, vi } from "vitest";
import { visibleRect } from "../../src/core/utils";
import { createDriver, nextFrame, useDriverHarness } from "../utils";

useDriverHarness();

afterEach(() => vi.restoreAllMocks());

// jsdom has no layout: each element is given its box, and scrolling it into view does nothing
Element.prototype.scrollIntoView ??= () => {};

const boxes = new Map<Element, DOMRect>();

function place(element: Element, x: number, y: number, width: number, height: number) {
  boxes.set(element, new DOMRect(x, y, width, height));
}

function mockLayout() {
  boxes.clear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return boxes.get(this) ?? new DOMRect(0, 0, 0, 0);
  });
}

// a 200px wide panel at x=100 holding a 500px wide row
function panelWithRow(panelStyle: string, rowStyle = "") {
  document.body.innerHTML = `<div id="panel" style="${panelStyle}"><div id="row" style="${rowStyle}">Row</div></div>`;
  const panel = document.getElementById("panel")!;
  const row = document.getElementById("row")!;
  mockLayout();
  place(panel, 100, 50, 200, 100);
  place(row, 100, 60, 500, 20);
  return { panel, row };
}

const sides = (r: DOMRect) => [r.left, r.top, r.right, r.bottom];

describe("visibleRect", () => {
  it("trims an element to the panel that scrolls it", () => {
    const { row } = panelWithRow("overflow-x: auto");
    expect(sides(visibleRect(row))).toEqual([100, 60, 300, 80]);
  });

  it("trims to overflow: hidden and clip too, but not visible", () => {
    expect(sides(visibleRect(panelWithRow("overflow: hidden").row))).toEqual([100, 60, 300, 80]);
    expect(sides(visibleRect(panelWithRow("overflow-x: clip").row))).toEqual([100, 60, 300, 80]);
    expect(sides(visibleRect(panelWithRow("overflow: visible").row))).toEqual([100, 60, 600, 80]);
  });

  it("leaves an absolutely positioned element whose containing block is outside the panel", () => {
    const { row } = panelWithRow("overflow: auto", "position: absolute");
    expect(sides(visibleRect(row))).toEqual([100, 60, 600, 80]);
  });

  it("trims an absolutely positioned element inside a positioned panel", () => {
    const { row } = panelWithRow("overflow: auto; position: relative", "position: absolute");
    expect(sides(visibleRect(row))).toEqual([100, 60, 300, 80]);
  });

  it("leaves a fixed element, unless the panel is transformed", () => {
    expect(sides(visibleRect(panelWithRow("overflow: auto; position: relative", "position: fixed").row))).toEqual([
      100, 60, 600, 80,
    ]);
    expect(sides(visibleRect(panelWithRow("overflow: auto; transform: scale(1)", "position: fixed").row))).toEqual([
      100, 60, 300, 80,
    ]);
  });

  it("gives an element scrolled out of sight a sliver on the edge it is behind", () => {
    const { row } = panelWithRow("overflow: auto");
    place(row, 400, 60, 100, 20);
    const rect = visibleRect(row);
    expect(rect.left).toBe(300);
    expect(rect.width).toBe(0);
  });

  it("trims through every clipping ancestor", () => {
    document.body.innerHTML = `<div id="outer" style="overflow: hidden"><div id="panel" style="overflow: auto"><div id="row">Row</div></div></div>`;
    mockLayout();
    place(document.getElementById("outer")!, 0, 0, 250, 300);
    place(document.getElementById("panel")!, 100, 0, 400, 300);
    place(document.getElementById("row")!, 50, 10, 600, 20);
    expect(sides(visibleRect(document.getElementById("row")!))).toEqual([100, 10, 250, 30]);
  });
});

describe("highlighting inside a scrolling panel", () => {
  it("cuts the overlay out only round the part of the element in view", async () => {
    const { row } = panelWithRow("overflow-x: auto");
    const d = createDriver({ animate: false, stagePadding: 0, steps: [{ element: row }] });
    d.drive();
    await nextFrame();

    expect(d.getState("__activeStagePosition")).toMatchObject({ x: 100, width: 200 });
  });

  it("follows the panel as it scrolls", async () => {
    const { panel, row } = panelWithRow("overflow-x: auto");
    const d = createDriver({ animate: false, stagePadding: 0, steps: [{ element: row }] });
    d.drive();
    await nextFrame();

    place(row, 250, 60, 500, 20);
    panel.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(d.getState("__activeStagePosition")).toMatchObject({ x: 250, width: 50 });
  });
});
