import type { Context } from "./context";

export function mountLiveRegion(ctx: Context) {
  if (ctx.getState("__liveRegion")) {
    return;
  }

  const region = document.createElement("div");
  region.className = "driver-live-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");

  Object.assign(region.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: "0",
  });

  document.body.appendChild(region);
  ctx.setState("__liveRegion", region);
}

export function announce(ctx: Context, message: string) {
  const region = ctx.getState("__liveRegion");
  const text = message.trim();
  if (!region || !text || ctx.getState("__lastAnnouncement") === text) {
    return;
  }

  ctx.setState("__lastAnnouncement", text);
  region.textContent = text;
}

export function destroyLiveRegion(ctx: Context) {
  ctx.getState("__liveRegion")?.remove();
}
