import { createEngine } from "./core/engine";
import { domRenderer } from "./renderer/dom";
import type { Config, Driver } from "./types";
import "./styles/driver.css";

export type {
  AdvanceOn,
  AdvanceOnEvent,
  AdvanceOnOpts,
  AllowedElements,
  Config,
  DestroyReason,
  DriverHook,
  ElementMissing,
  ElementMissingHook,
  ElementMissingOpts,
  ElementMissingPreset,
  WaitingForElementHook,
  WaitingForElementOpts,
  HookOpts,
  InteractionHook,
  InteractionOpts,
  InteractionRegion,
  PopoverPatch,
  Driver,
  DriveStep,
  Popover,
  State,
} from "./types";
export type { StageDefinition } from "./overlay/stage";
export type { PopoverDOM, Side, Alignment, AllowedButtons } from "./popover/popover";

export function driver(options: Config = {}): Driver {
  return createEngine(options, domRenderer);
}
