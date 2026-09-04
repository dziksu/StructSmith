import { create } from "zustand";

export type Selection =
  | { type: "none" }
  | { type: "element"; id: string }
  | { type: "relationship"; id: string }
  | { type: "view"; id: string }
  | { type: "record"; id: string };

export type ExplorerTab = "model" | "views" | "presales";
export type BottomPanel = "issues" | "activity" | "snapshots" | null;

interface EditorState {
  /** Short-lived editor state only — server state lives in TanStack Query. */
  selection: Selection;
  explorerTab: ExplorerTab;
  bottomPanel: BottomPanel;
  commandOpen: boolean;
  paletteOpen: boolean;
  connectFrom: string | null;
  focusRequest: { elementId: string; nonce: number } | null;
  pendingSave: number;

  select: (selection: Selection) => void;
  clearSelection: () => void;
  setExplorerTab: (tab: ExplorerTab) => void;
  setBottomPanel: (panel: BottomPanel) => void;
  setCommandOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setConnectFrom: (elementId: string | null) => void;
  requestFocus: (elementId: string) => void;
  beginSave: () => void;
  endSave: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selection: { type: "none" },
  explorerTab: "model",
  bottomPanel: null,
  commandOpen: false,
  paletteOpen: false,
  connectFrom: null,
  focusRequest: null,
  pendingSave: 0,

  select: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { type: "none" }, connectFrom: null }),
  setExplorerTab: (explorerTab) => set({ explorerTab }),
  setBottomPanel: (bottomPanel) => set((state) => ({ bottomPanel: state.bottomPanel === bottomPanel ? null : bottomPanel })),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setConnectFrom: (connectFrom) => set({ connectFrom }),
  requestFocus: (elementId) => set({ focusRequest: { elementId, nonce: Date.now() } }),
  beginSave: () => set((state) => ({ pendingSave: state.pendingSave + 1 })),
  endSave: () => set((state) => ({ pendingSave: Math.max(0, state.pendingSave - 1) })),
}));
