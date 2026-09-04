import { create } from "zustand";

/**
 * Undo/redo is client-side only (spec §4) and rides on server snapshots:
 * every batch command returns the snapshot taken right before it ran.
 */
export type HistoryEntry =
  | { kind: "snapshot"; snapshotId: string; label: string }
  | {
      kind: "layout";
      viewId: string;
      entries: { elementId: string; x: number; y: number }[];
      label: string;
    };

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  push: (entry: HistoryEntry) => void;
  /** Appends to the undo stack without clearing the redo stack. */
  pushUndo: (entry: HistoryEntry) => void;
  popUndo: () => HistoryEntry | undefined;
  popRedo: () => HistoryEntry | undefined;
  pushRedo: (entry: HistoryEntry) => void;
  reset: () => void;
}

const LIMIT = 50;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  push: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack, entry].slice(-LIMIT),
      redoStack: [],
    })),
  pushUndo: (entry) => set((state) => ({ undoStack: [...state.undoStack, entry].slice(-LIMIT) })),
  popUndo: () => {
    const stack = get().undoStack;
    const entry = stack[stack.length - 1];
    if (entry) set({ undoStack: stack.slice(0, -1) });
    return entry;
  },
  popRedo: () => {
    const stack = get().redoStack;
    const entry = stack[stack.length - 1];
    if (entry) set({ redoStack: stack.slice(0, -1) });
    return entry;
  },
  pushRedo: (entry) => set((state) => ({ redoStack: [...state.redoStack, entry].slice(-LIMIT) })),
  reset: () => set({ undoStack: [], redoStack: [] }),
}));
