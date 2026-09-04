import type {
  ArchitectureElement,
  ArchitectureRecord,
  ArchitectureView,
  ViewDetail,
} from "@structsmith/contracts";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorStore, type ExplorerTab } from "@/store/editor";
import { ModelTree } from "./ModelTree";
import { PresalesPanel } from "./PresalesPanel";
import { ViewsPanel } from "./ViewsPanel";

interface ExplorerProps {
  workspaceId: string;
  elements: readonly ArchitectureElement[];
  views: readonly ArchitectureView[];
  records: readonly ArchitectureRecord[];
  view: ViewDetail | null;
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
}

export function Explorer(props: ExplorerProps) {
  const { t } = useTranslation();
  const tab = useEditorStore((state) => state.explorerTab);
  const setTab = useEditorStore((state) => state.setExplorerTab);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as ExplorerTab)}
      className="flex h-full min-h-0 flex-col bg-card"
    >
      <TabsList>
        <TabsTrigger value="model">{t("explorer.model")}</TabsTrigger>
        <TabsTrigger value="views">{t("explorer.views")}</TabsTrigger>
        <TabsTrigger value="presales">{t("explorer.presales")}</TabsTrigger>
      </TabsList>

      <TabsContent value="model" className="min-h-0">
        <ModelTree workspaceId={props.workspaceId} elements={props.elements} view={props.view} />
      </TabsContent>
      <TabsContent value="views" className="min-h-0">
        <ViewsPanel
          workspaceId={props.workspaceId}
          views={props.views}
          elements={props.elements}
          activeViewId={props.activeViewId}
          onSelectView={props.onSelectView}
        />
      </TabsContent>
      <TabsContent value="presales" className="min-h-0">
        <PresalesPanel
          workspaceId={props.workspaceId}
          records={props.records}
          elements={props.elements}
        />
      </TabsContent>
    </Tabs>
  );
}
