import type { Context, ControlActions } from "./context";
import type { DriveStep } from "../types";

export type Renderer = {
  blocksInteraction: boolean;
  controls?: (ctx: Context) => ControlActions;

  mount: (ctx: Context) => void;
  detach: (ctx: Context) => void;
  unmount: (ctx: Context) => void;

  highlight: (ctx: Context, step: DriveStep) => void;
  rebind: (ctx: Context, element: Element) => void;
  refresh: (ctx: Context) => void;
  trackAllowed: (ctx: Context, step: DriveStep, signal: AbortSignal) => void;

  showWaiting: (ctx: Context) => void;
  hideWaiting: (ctx: Context, element: Element | undefined, step: DriveStep | undefined) => void;
  showInitialWait: (ctx: Context, stepIndex: number) => void;
  endInitialWait: (ctx: Context) => void;

  refreshPopover: (ctx: Context) => void;
  nudge: (ctx: Context) => void;
  announce: (ctx: Context, message: string) => void;
  restoreFocus: (element: Element) => void;
};
