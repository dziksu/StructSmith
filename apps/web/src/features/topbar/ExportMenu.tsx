import { toPng, toSvg } from "html-to-image";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApiErrorHandler } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { downloadBlob, downloadJson, downloadText } from "@/lib/download";

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "diagram";

/** PNG/SVG come from the live canvas; JSON and Mermaid come from the model. */
async function captureCanvas(format: "png" | "svg"): Promise<string | null> {
  const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewport) return null;

  const options = {
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    pixelRatio: 2,
    filter: (node: HTMLElement) =>
      !node.classList?.contains?.("react-flow__minimap") &&
      !node.classList?.contains?.("react-flow__controls"),
  };
  return format === "png" ? toPng(viewport, options) : toSvg(viewport, options);
}

export function ExportMenu({
  workspaceId,
  workspaceName,
  viewId,
  viewName,
}: {
  workspaceId: string;
  workspaceName: string;
  viewId: string | null;
  viewName: string | null;
}) {
  const { t } = useTranslation();
  const onError = useApiErrorHandler();
  const base = slug(viewName ?? workspaceName);

  const exportImage = async (format: "png" | "svg"): Promise<void> => {
    try {
      const dataUrl = await captureCanvas(format);
      if (!dataUrl) return;
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), `${base}.${format}`);
      toast.success(t("exportMenu.done"));
    } catch (error) {
      onError(error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Download className="h-3.5 w-3.5" />
          {t("topbar.export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("exportMenu.title")}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() =>
            api
              .getDocument(workspaceId)
              .then((document) => {
                downloadJson(document, `${slug(workspaceName)}.json`);
                toast.success(t("exportMenu.done"));
              })
              .catch(onError)
          }
        >
          {t("exportMenu.json")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            api
              .exportMermaid(workspaceId, viewId ?? undefined)
              .then((mermaid) => {
                downloadText(mermaid, `${base}.mmd`);
                toast.success(t("exportMenu.done"));
              })
              .catch(onError)
          }
        >
          {t("exportMenu.mermaid")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void exportImage("png")}>
          {t("exportMenu.png")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportImage("svg")}>
          {t("exportMenu.svg")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
