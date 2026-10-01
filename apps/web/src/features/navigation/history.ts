import type { Viewport } from "@xyflow/react";
import type { Selection } from "@/store/editor";

export interface ViewLocation {
  viewId: string;
  viewport: Viewport;
  selection: Selection;
}

export interface ViewNavigation {
  back: ViewLocation[];
  saved: Record<string, ViewLocation>;
}

export const emptyNavigation = (): ViewNavigation => ({ back: [], saved: {} });

export function visitView(
  state: ViewNavigation,
  current: ViewLocation,
  targetId: string,
): ViewNavigation {
  if (current.viewId === targetId) return state;
  return {
    back: [...state.back, current].slice(-50),
    saved: { ...state.saved, [current.viewId]: current },
  };
}

export function returnToView(
  state: ViewNavigation,
  current: ViewLocation,
  index: number,
): ViewNavigation {
  const target = state.back[index];
  if (!target) return state;
  return {
    back: state.back.slice(0, index),
    saved: { ...state.saved, [current.viewId]: current, [target.viewId]: target },
  };
}
