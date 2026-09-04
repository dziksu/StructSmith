import type { ArchitectureView, Workspace } from "@structsmith/contracts";
import {
  ChevronDown,
  Languages,
  LayoutGrid,
  Maximize,
  Monitor,
  Moon,
  Plug,
  Plus,
  Redo2,
  Search,
  Sun,
  Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { supportedLanguages } from "@/i18n";
import { type Theme, useTheme } from "@/lib/theme";
import { useEditorStore } from "@/store/editor";
import { ExportMenu } from "./ExportMenu";

interface TopBarProps {
  productName: string;
  workspace: Workspace;
  workspaces: readonly Workspace[];
  views: readonly ArchitectureView[];
  activeView: ArchitectureView | null;
  canUndo: boolean;
  canRedo: boolean;
  mcpReadOnly: boolean;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectView: (viewId: string) => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenMcp: () => void;
  onGoHome: () => void;
}

export function TopBar(props: TopBarProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const setCommandOpen = useEditorStore((state) => state.setCommandOpen);
  const setPaletteOpen = useEditorStore((state) => state.setPaletteOpen);
  const setExplorerTab = useEditorStore((state) => state.setExplorerTab);

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-card px-2">
      <button
        type="button"
        onClick={props.onGoHome}
        className="mr-1 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-1 text-[12.5px] font-semibold tracking-tight transition-colors hover:bg-accent"
      >
        <Logo size={16} />
        {props.productName}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-[190px]">
            <span className="truncate">{props.workspace.name}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t("topbar.workspace")}</DropdownMenuLabel>
          {props.workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => props.onSelectWorkspace(workspace.id)}
            >
              {workspace.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={props.onGoHome}>{t("topbar.backHome")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-[190px]">
            <LayoutGrid className="h-3.5 w-3.5 opacity-70" />
            <span className="truncate">{props.activeView?.name ?? t("topbar.view")}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t("topbar.view")}</DropdownMenuLabel>
          {props.views.map((view) => (
            <DropdownMenuItem key={view.id} onSelect={() => props.onSelectView(view.id)}>
              {view.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setExplorerTab("views")}>
            {t("topbar.newView")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <Button variant="secondary" size="sm" onClick={() => setPaletteOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        {t("topbar.add")}
      </Button>

      <Tooltip label={t("topbar.autoLayout")}>
        <Button variant="ghost" size="iconSm" onClick={props.onAutoLayout}>
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>

      <Tooltip label={`${t("topbar.fitView")} (F)`}>
        <Button variant="ghost" size="iconSm" onClick={props.onFitView}>
          <Maximize className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>

      <Tooltip label={`${t("topbar.undo")} (⌘Z)`}>
        <Button variant="ghost" size="iconSm" onClick={props.onUndo} disabled={!props.canUndo}>
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>

      <Tooltip label={`${t("topbar.redo")} (⌘⇧Z)`}>
        <Button variant="ghost" size="iconSm" onClick={props.onRedo} disabled={!props.canRedo}>
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>

      <span className="flex-1" />

      <Tooltip label={t("topbar.search")}>
        <Button variant="ghost" size="iconSm" onClick={() => setCommandOpen(true)}>
          <Search className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>

      <ExportMenu
        workspaceId={props.workspace.id}
        workspaceName={props.workspace.name}
        viewId={props.activeView?.id ?? null}
        viewName={props.activeView?.name ?? null}
      />

      <Tooltip label={t("mcp.title")}>
        <Button variant="ghost" size="sm" onClick={props.onOpenMcp}>
          <Plug className="h-3.5 w-3.5 text-success" />
          MCP
          {props.mcpReadOnly && <span className="text-[10px] opacity-70">RO</span>}
        </Button>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="iconSm">
            <ThemeIcon className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("settings.theme")}</DropdownMenuLabel>
          {(["light", "dark", "system"] as Theme[]).map((value) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={theme === value}
              onCheckedChange={() => setTheme(value)}
            >
              {t(`theme.${value}`)}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1">
            <Languages className="h-3 w-3" />
            {t("settings.language")}
          </DropdownMenuLabel>
          {supportedLanguages.map((language) => (
            <DropdownMenuCheckboxItem
              key={language.code}
              checked={i18n.resolvedLanguage === language.code}
              onCheckedChange={() => void i18n.changeLanguage(language.code)}
            >
              {language.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
