import type { Context } from "../core/context";

export function mountLiveRegion(ctx: Context) {
  if (ctx.state.__liveRegion) {
    return;
  }

  const region = document.createElement("div");
  region.className = "driver-live-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");

  region.style.cssText =
    "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0";

  document.body.appendChild(region);
  ctx.state.__liveRegion = region;
}

export function announce(ctx: Context, message: string) {
  const region = ctx.state.__liveRegion;
  const text = message.trim();
  if (!region || !text || ctx.state.__lastAnnouncement === text) {
    return;
  }

  ctx.state.__lastAnnouncement = text;
  region.textContent = text;
}

export function destroyLiveRegion(ctx: Context) {
  ctx.state.__liveRegion?.remove();
}
