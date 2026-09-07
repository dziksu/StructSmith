import { ArrowLeft, Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMcpInfo, useSettings } from "@/hooks/useApi";

type ClientId = "codex" | "claudeCode" | "claudeDesktop" | "copilot" | "generic";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-4 py-2">
    <span className="w-32 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <div className="flex-1 text-[13px]">{children}</div>
  </div>
);

export function McpPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const info = useMcpInfo();
  const settings = useSettings();
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientId>("codex");

  const endpoint = info.data?.endpoint ?? `${window.location.origin}/mcp`;

  const copy = async (value: string, target: string): Promise<void> => {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    toast.success(t("common.copied"));
    setTimeout(() => setCopied(null), 1500);
  };

  const genericConfig = JSON.stringify(
    { mcpServers: { structsmith: { type: "http", url: endpoint } } },
    null,
    2,
  );
  const clients: Array<{ id: ClientId; label: string; hint: string; snippet: string }> = [
    {
      id: "codex",
      label: t("mcp.clientCodex"),
      hint: t("mcp.codexHint"),
      snippet: `codex mcp add structsmith --url ${endpoint}`,
    },
    {
      id: "claudeCode",
      label: t("mcp.clientClaudeCode"),
      hint: t("mcp.claudeCodeHint"),
      snippet: `claude mcp add --transport http structsmith ${endpoint}`,
    },
    {
      id: "claudeDesktop",
      label: t("mcp.clientClaudeDesktop"),
      hint: t("mcp.claudeDesktopHint"),
      snippet: JSON.stringify(
        {
          mcpServers: {
            structsmith: {
              command: "npx",
              args: [
                "-y",
                "mcp-remote@latest",
                endpoint,
                "--transport",
                "http-only",
                "--allow-http",
              ],
            },
          },
        },
        null,
        2,
      ),
    },
    {
      id: "copilot",
      label: t("mcp.clientCopilot"),
      hint: t("mcp.copilotHint"),
      snippet: JSON.stringify(
        { servers: { structsmith: { type: "http", url: endpoint } } },
        null,
        2,
      ),
    },
    {
      id: "generic",
      label: t("mcp.clientGeneric"),
      hint: t("mcp.genericHint"),
      snippet: genericConfig,
    },
  ];
  const activeClient =
    clients.find((client) => client.id === selectedClient) ?? (clients[0] as (typeof clients)[0]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.close")}
        </Button>

        <h1 className="text-lg font-semibold tracking-tight">{t("mcp.title")}</h1>
        <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">{t("mcp.subtitle")}</p>

        <div className="mt-6 rounded-lg border border-border bg-card px-4 py-2">
          <Row label={t("mcp.status")}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {t("mcp.running")} · {t("mcp.connected")}
            </span>
          </Row>
          <Separator />
          <Row label={t("mcp.transport")}>Streamable HTTP</Row>
          <Separator />
          <Row label={t("mcp.endpoint")}>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                {endpoint}
              </code>
              <Button size="sm" variant="ghost" onClick={() => void copy(endpoint, "endpoint")}>
                {copied === "endpoint" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {t("mcp.copyEndpoint")}
              </Button>
            </div>
          </Row>
          <Separator />
          <Row label={t("mcp.readOnly")}>
            {info.data?.readOnly ? (
              <Badge variant="warning">{t("mcp.readOnlyOn")}</Badge>
            ) : (
              <Badge variant="success">{t("mcp.readOnlyOff")}</Badge>
            )}
          </Row>
          <Separator />
          <Row label={t("mcp.authMode")}>
            {info.data?.authMode === "token" ? t("mcp.authToken") : t("mcp.authNone")}
          </Row>
          <Separator />
          <Row label="Version">{settings.data?.version ?? "—"}</Row>
        </div>

        <section className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[13px] font-semibold">{t("mcp.howToTitle")}</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{t("mcp.howToHint")}</p>
            </div>
            <Button variant="link" size="sm" asChild className="shrink-0 px-0">
              <a
                href="https://github.com/dziksu/StructSmith/blob/main/docs/AI_CLIENTS.md"
                target="_blank"
                rel="noreferrer"
              >
                {t("mcp.fullGuide")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
            {clients.map((client) => (
              <Button
                key={client.id}
                size="sm"
                variant={client.id === selectedClient ? "secondary" : "ghost"}
                onClick={() => setSelectedClient(client.id)}
              >
                {client.label}
              </Button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <h3 className="text-[12px] font-medium">{activeClient.label}</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void copy(activeClient.snippet, activeClient.id)}
            >
              {copied === activeClient.id ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {t("common.copy")}
            </Button>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">{activeClient.hint}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-[11.5px] leading-relaxed">
            {activeClient.snippet}
          </pre>
        </section>

        <section className="mt-6">
          <h2 className="text-[13px] font-semibold">
            {t("mcp.tools")}{" "}
            <span className="text-muted-foreground">({info.data?.tools.length ?? 0})</span>
          </h2>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {info.data?.tools.map((tool) => (
              <div key={tool.name} className="rounded border border-border bg-card px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                  <code className="font-mono text-[12px]">{tool.name}</code>
                  <Badge variant={tool.mutating ? "primary" : "outline"}>
                    {tool.mutating ? t("mcp.mutating") : t("mcp.readOnlyTool")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-[13px] font-semibold">{t("mcp.resources")}</h2>
            <ul className="mt-2 space-y-1">
              {info.data?.resources.map((resource) => (
                <li key={resource} className="font-mono text-[11.5px] text-muted-foreground">
                  {resource}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[13px] font-semibold">{t("mcp.prompts")}</h2>
            <ul className="mt-2 space-y-1">
              {info.data?.prompts.map((prompt) => (
                <li key={prompt.name} className="text-[12px]">
                  <code className="font-mono text-[11.5px]">{prompt.name}</code>
                  <span className="ml-1.5 text-muted-foreground">{prompt.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
