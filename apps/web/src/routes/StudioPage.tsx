import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import { Canvas } from "@/features/canvas/Canvas";
import { CommandPalette } from "@/features/command/CommandPalette";
import { ElementPalette } from "@/features/command/ElementPalette";
import { KeyboardShortcutsDialog } from "@/features/command/KeyboardShortcutsDialog";
import { Explorer } from "@/features/explorer/Explorer";
import { Inspector } from "@/features/inspector/Inspector";
import { BottomPanel } from "@/features/panels/BottomPanel";
import { StatusBar } from "@/features/panels/StatusBar";
import { TopBar } from "@/features/topbar/TopBar";
import {
  useApplyOperations,
  useModel,
  useRecords,
  useSettings,
  useValidation,
  useView,
  useViews,
  useWorkspace,
  useWorkspaces,
} from "@/hooks/useApi";
import { useHistory } from "@/hooks/useHistory";
import { useWorkspaceEvents } from "@/hooks/useWorkspaceEvents";
import { parseReferenceSearchValue } from "@/lib/agentReference";
import { hasPrimaryModifier } from "@/lib/platform";
import { useEditorStore } from "@/store/editor";
import { useHistoryStore } from "@/store/history";

interface StudioPageProps {
  workspaceId: string;
  viewId: string | null;
  reference?: string;
  onNavigate: (workspaceId: string, viewId: string | null) => void;
  onOpenMcp: () => void;
  onGoHome: () => void;
}

export function StudioPage(props: StudioPageProps) {
  return (
    <ReactFlowProvider>
      <StudioContent {...props} />
    </ReactFlowProvider>
  );
}

function StudioContent({
  workspaceId,
  viewId,
  reference,
  onNavigate,
  onOpenMcp,
  onGoHome,
}: StudioPageProps) {
  const { t } = useTranslation();
  const flow = useReactFlow();

  const settings = useSettings();
  const workspaces = useWorkspaces();
  const workspace = useWorkspace(workspaceId);
  const model = useModel(workspaceId);
  const views = useViews(workspaceId);
  const records = useRecords(workspaceId);
  const validation = useValidation(workspaceId);

  const activeViewId = viewId ?? views.data?.[0]?.id ?? null;
  const view = useView(activeViewId);
  const applyOperations = useApplyOperations(workspaceId);
  const history = useHistory(workspaceId);
  const resetHistory = useHistoryStore((state) => state.reset);

  const clearSelection = useEditorStore((state) => state.clearSelection);
  const selection = useEditorStore((state) => state.selection);
  const select = useEditorStore((state) => state.select);
  const requestFocus = useEditorStore((state) => state.requestFocus);
  const setExplorerTab = useEditorStore((state) => state.setExplorerTab);
  const setCommandOpen = useEditorStore((state) => state.setCommandOpen);
  const setShortcutsOpen = useEditorStore((state) => state.setShortcutsOpen);
  const handledReference = useRef<string | null>(null);

  useWorkspaceEvents(workspaceId);

  // The undo stack holds snapshot ids of one workspace, so switching workspaces
  // has to reset it — otherwise undo would restore into the wrong workspace.
  // biome-ignore lint/correctness/useExhaustiveDependencies: workspaceId is the trigger, not a value the effect reads.
  useEffect(() => {
    resetHistory();
    clearSelection();
  }, [workspaceId, resetHistory, clearSelection]);

  useEffect(() => {
    if (!viewId && activeViewId) onNavigate(workspaceId, activeViewId);
  }, [viewId, activeViewId, workspaceId, onNavigate]);

  useEffect(() => {
    if (!reference || handledReference.current === reference) return;
    const parsed = parseReferenceSearchValue(reference);
    if (!parsed) return;

    handledReference.current = reference;
    if (parsed.type === "workspace") return;
    select({ type: parsed.type, id: parsed.targetId });
    if (parsed.type === "element" || parsed.type === "boundary") {
      setExplorerTab("model");
      if (parsed.type === "element") requestFocus(parsed.targetId);
    } else if (parsed.type === "view") {
      setExplorerTab("views");
    } else if (parsed.type === "record") {
      setExplorerTab("presales");
    }
  }, [reference, requestFocus, select, setExplorerTab]);

  const elements = useMemo(() => model.data?.elements ?? [], [model.data]);
  const boundaries = useMemo(() => view.data?.boundaries ?? [], [view.data]);
  const relationships = useMemo(() => model.data?.relationships ?? [], [model.data]);
  const recordList = useMemo(() => records.data ?? [], [records.data]);
  const viewList = useMemo(() => views.data ?? [], [views.data]);
  const activeView = viewList.find((item) => item.id === activeViewId) ?? null;

  const selectView = (nextViewId: string): void => onNavigate(workspaceId, nextViewId);

  const autoLayout = (
    algorithm: "dagre" | "force" | "radial" | "grid" = view.data?.settings.autoLayoutAlgorithm ??
      "dagre",
  ): void => {
    if (!view.data) return;
    const rootElementId = selection.type === "element" ? selection.id : undefined;
    const settingsChanged = algorithm !== view.data.settings.autoLayoutAlgorithm;
    applyOperations.mutate({
      label: t("topbar.autoLayout"),
      operations: [
        ...(settingsChanged
          ? [
              {
                op: "updateView" as const,
                viewId: view.data.id,
                data: { settings: { autoLayoutAlgorithm: algorithm } },
              },
            ]
          : []),
        {
          op: "autoLayoutView",
          viewId: view.data.id,
          direction: view.data.settings.autoLayoutDirection,
          algorithm,
          rootElementId,
        },
      ],
    });
  };

  const fitView = (): void => void flow.fitView({ duration: 300, padding: 0.2 });

  /* ------------------------------- shortcuts ------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      const primary = hasPrimaryModifier(event);

      if (primary && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (primary && event.key === "/") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (primary && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? history.redo() : history.undo());
        return;
      }
      if (primary && event.key.toLowerCase() === "s") {
        event.preventDefault();
        toast.success(t("status.saved"));
        return;
      }
      if (typing) return;
      if (event.key === "Escape") clearSelection();
      if (event.key.toLowerCase() === "f") fitView();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!workspace.data || !model.data) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        productName={settings.data?.productName ?? "StructSmith"}
        workspace={workspace.data}
        workspaces={workspaces.data ?? []}
        views={viewList}
        activeView={activeView}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        mcpReadOnly={settings.data?.mcpReadOnly ?? false}
        onSelectWorkspace={(id) => onNavigate(id, null)}
        onSelectView={selectView}
        onAutoLayout={autoLayout}
        onFitView={fitView}
        onUndo={() => void history.undo()}
        onRedo={() => void history.redo()}
        onOpenMcp={onOpenMcp}
        onGoHome={onGoHome}
      />

      <div className="min-h-0 flex-1">
        <Group orientation="horizontal">
          <Panel defaultSize="19%" minSize="12%" maxSize="34%">
            <Explorer
              workspaceId={workspaceId}
              elements={elements}
              boundaries={boundaries}
              views={viewList}
              records={recordList}
              view={view.data ?? null}
              activeViewId={activeViewId}
              onSelectView={selectView}
            />
          </Panel>
          <Separator className="w-px bg-border transition-colors hover:bg-primary/40" />

          <Panel minSize="30%">
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1 bg-canvas">
                {view.data ? (
                  <Canvas
                    key={view.data.id}
                    workspaceId={workspaceId}
                    view={view.data}
                    elements={elements}
                    boundaries={boundaries}
                    relationships={relationships}
                    records={recordList}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                    <p className="text-sm font-medium">{t("explorer.emptyViews")}</p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      {t("canvas.emptyHint")}
                    </p>
                  </div>
                )}
              </div>
              <BottomPanel workspaceId={workspaceId} />
            </div>
          </Panel>

          <Separator className="w-px bg-border transition-colors hover:bg-primary/40" />
          <Panel defaultSize="22%" minSize="14%" maxSize="40%">
            <Inspector
              workspaceId={workspaceId}
              elements={elements}
              boundaries={boundaries}
              relationships={relationships}
              records={recordList}
              view={view.data ?? null}
            />
          </Panel>
        </Group>
      </div>

      <StatusBar
        revision={model.data.revision}
        elementCount={elements.length}
        boundaryCount={boundaries.length}
        relationshipCount={relationships.length}
        validation={validation.data}
        mcpReady
        mcpReadOnly={settings.data?.mcpReadOnly ?? false}
      />

      <ElementPalette workspaceId={workspaceId} view={view.data ?? null} />
      <KeyboardShortcutsDialog />
      <CommandPalette
        elements={elements}
        relationships={relationships}
        views={viewList}
        records={recordList}
        activeViewId={activeViewId}
        onSelectView={selectView}
        viewContains={(elementId) =>
          (view.data?.elements ?? []).some(
            (entry) => entry.elementId === elementId && !entry.hidden,
          )
        }
        findViewWith={(elementId) =>
          viewList.find((candidate) =>
            candidate.elements.some((entry) => entry.elementId === elementId && !entry.hidden),
          )?.id ?? null
        }
      />
    </div>
  );
}
