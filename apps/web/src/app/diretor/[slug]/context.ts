"use client";

import { createContext, useContext } from "react";
import type { ProgramBranding, Scene } from "@/lib/scene";
import type { AssetItem } from "./assets";

export type Scenes = { live: Scene; draft: Scene };

export type SceneRequest =
  | { action: "patch"; target: "draft" | "live" | "both"; patch: unknown }
  | { action: "take" }
  | { action: "clock"; op: "start" | "pause" | "reset" | "set"; ms?: number };

export type DirectorCtx = {
  slug: string;
  branding: ProgramBranding;
  setBranding: (b: ProgramBranding) => void;
  scenes: Scenes;
  // Controls edit the preview; with "direct" on they also hit air.
  direct: boolean;
  setDirect: (direct: boolean) => void;
  // `air: true` forces the change on air too (scores, clock): it can't wait for a take.
  patch: (patch: unknown, opts?: { air?: boolean }) => Promise<void>;
  sceneRequest: (body: SceneRequest) => Promise<void>;
  assets: AssetItem[];
  addAsset: (asset: AssetItem) => void;
  removeAsset: (id: string) => Promise<void>;
};

export const DirectorContext = createContext<DirectorCtx | null>(null);

export function useDirector(): DirectorCtx {
  const ctx = useContext(DirectorContext);
  if (!ctx) throw new Error("useDirector outside DirectorContext");
  return ctx;
}
