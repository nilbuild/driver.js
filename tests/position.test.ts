import { describe, expect, it } from "vitest";
import { calculateArrowOffset, calculateArrowTarget, resolveArrowSide } from "../src/position";

// These cover the pure geometry directly, without a DOM or the driver harness.
// The integration counterparts live in popover.test.ts.

describe("resolveArrowSide", () => {
  // Popover box used across these cases.
  const popover = { top: 100, bottom: 400, left: 600, right: 800 };

  it("keeps the side edge when the element overlaps the popover vertically", () => {
    const element = { top: 150, bottom: 250, left: 800, right: 900 };
    expect(resolveArrowSide("left", element, popover)).toBe("left");
    expect(resolveArrowSide("right", element, popover)).toBe("right");
  });

  it("points up when a side-placed element scrolls above the popover", () => {
    // Element fully above the popover → arrow moves to the top edge (side "bottom").
    const element = { top: -200, bottom: -50, left: 800, right: 900 };
    expect(resolveArrowSide("left", element, popover)).toBe("bottom");
    expect(resolveArrowSide("right", element, popover)).toBe("bottom");
  });

  it("points down when a side-placed element scrolls below the popover", () => {
    // Element fully below the popover → arrow moves to the bottom edge (side "top").
    const element = { top: 500, bottom: 600, left: 800, right: 900 };
    expect(resolveArrowSide("left", element, popover)).toBe("top");
    expect(resolveArrowSide("right", element, popover)).toBe("top");
  });

  it("keeps the edge when a top/bottom element overlaps the popover horizontally", () => {
    const element = { top: 420, bottom: 520, left: 650, right: 750 };
    expect(resolveArrowSide("top", element, popover)).toBe("top");
    expect(resolveArrowSide("bottom", element, popover)).toBe("bottom");
  });

  it("points sideways when a top/bottom element scrolls clear horizontally", () => {
    const toTheRight = { top: 420, bottom: 520, left: 900, right: 1000 };
    expect(resolveArrowSide("bottom", toTheRight, popover)).toBe("left");

    const toTheLeft = { top: 420, bottom: 520, left: 0, right: 100 };
    expect(resolveArrowSide("bottom", toTheLeft, popover)).toBe("right");
  });
});

describe("calculateArrowTarget", () => {
  it("aims at the element's center when it sits inside the popover edge", () => {
    // Element spans 200..260 (center 230) within a popover spanning 100..400.
    expect(calculateArrowTarget(200, 260, 100, 400, "start")).toBe(130);
  });

  it("ignores alignment for an element that doesn't span the whole edge", () => {
    // Same element; align "end" must not change where it points.
    expect(calculateArrowTarget(200, 260, 100, 400, "end")).toBe(130);
  });

  it("aims at the center of the overlap when the element runs past one edge", () => {
    // Element 300..500 against popover 100..400 overlaps on 300..400 → center 350.
    expect(calculateArrowTarget(300, 500, 100, 400, "center")).toBe(250);
  });

  it("collapses onto the near edge when the element is entirely past the popover", () => {
    // Entirely below → both endpoints clamp to the popover's far edge.
    expect(calculateArrowTarget(500, 600, 100, 400, "center")).toBe(300);
    // Entirely above → both clamp to the leading edge.
    expect(calculateArrowTarget(-100, -50, 100, 400, "center")).toBe(0);
  });

  describe("when the element spans the whole popover edge", () => {
    // Popover length 300. The element overlaps both ends, so alignment decides.
    it("places the target at the start inset for align: start", () => {
      expect(calculateArrowTarget(0, 500, 100, 400, "start")).toBe(20);
    });

    it("centers the target for align: center", () => {
      expect(calculateArrowTarget(0, 500, 100, 400, "center")).toBe(150);
    });

    it("places the target at the end inset for align: end", () => {
      expect(calculateArrowTarget(0, 500, 100, 400, "end")).toBe(280);
    });
  });
});

describe("calculateArrowOffset", () => {
  it("centers the arrow box on the target", () => {
    // Target 130 → box top 125 (arrow box is 10px wide).
    expect(calculateArrowOffset(130, 300)).toBe(125);
  });

  it("clamps to the leading corner inset", () => {
    expect(calculateArrowOffset(5, 300)).toBe(15);
  });

  it("clamps to the trailing corner inset", () => {
    expect(calculateArrowOffset(295, 300)).toBe(275);
  });

  it("centers the arrow when the popover is too small for the insets", () => {
    // length 30 can't honor a 15px inset on both sides → centered: (30-10)/2.
    expect(calculateArrowOffset(20, 30)).toBe(10);
  });

  it("never returns a negative offset for a zero-length popover", () => {
    expect(calculateArrowOffset(0, 0)).toBe(0);
  });
});
