import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { McpPage } from "@/features/mcp/McpPage";
import { HomePage } from "@/features/home/HomePage";
import { StudioPage } from "./StudioPage";

const rootRoute = createRootRoute({
  component: () => (
    <TooltipProvider delayDuration={300}>
      <Outlet />
    </TooltipProvider>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: function Home() {
    const navigate = useNavigate();
    return (
      <HomePage
        onOpenWorkspace={(workspaceId) =>
          void navigate({ to: "/w/$workspaceId", params: { workspaceId } })
        }
      />
    );
  },
});

interface StudioSearch {
  view?: string;
}

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$workspaceId",
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    view: typeof search.view === "string" ? search.view : undefined,
  }),
  component: function Studio() {
    const navigate = useNavigate();
    const { workspaceId } = useParams({ from: "/w/$workspaceId" });
    const { view } = useSearch({ from: "/w/$workspaceId" });

    return (
      <StudioPage
        workspaceId={workspaceId}
        viewId={view ?? null}
        onNavigate={(nextWorkspaceId, nextViewId) =>
          void navigate({
            to: "/w/$workspaceId",
            params: { workspaceId: nextWorkspaceId },
            search: nextViewId ? { view: nextViewId } : {},
            replace: true,
          })
        }
        onOpenMcp={() => void navigate({ to: "/settings/mcp" })}
        onGoHome={() => void navigate({ to: "/" })}
      />
    );
  },
});

const mcpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings/mcp",
  component: function Mcp() {
    const navigate = useNavigate();
    return <McpPage onBack={() => void navigate({ to: "/" })} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, workspaceRoute, mcpRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
