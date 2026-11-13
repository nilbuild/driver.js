import { createEngine } from "./core/engine";
import { headlessRenderer } from "./renderer/headless";
import type { Config, Driver } from "./types";

export type {
  AdvanceOn,
  AdvanceOnEvent,
  AdvanceOnOpts,
  Config,
  DestroyReason,
  DriverHook,
  ElementMissing,
  ElementMissingHook,
  ElementMissingOpts,
  ElementMissingPreset,
  WaitingForElementHook,
  WaitingForElementOpts,
  ScrollIntoViewOpts,
  StepFocus,
  HookOpts,
  InteractionHook,
  InteractionOpts,
  InteractionRegion,
  Driver,
  DriveStep,
  Popover,
  State,
} from "./types";

export function driver(options: Config = {}): Driver {
  return createEngine(options, headlessRenderer);
}
