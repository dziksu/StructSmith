import { ArrowLeft, Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMcpInfo, useSettings } from "@/hooks/useApi";

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
  const [copied, setCopied] = useState(false);

  const endpoint = info.data?.endpoint ?? `${window.location.origin}/mcp`;

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    toast.success(t("common.copied"));
    setTimeout(() => setCopied(false), 1500);
  };

  const clientConfig = JSON.stringify(
    { mcpServers: { structsmith: { type: "http", url: endpoint } } },
    null,
    2,
  );

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
              <Button size="sm" variant="ghost" onClick={() => void copy()}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
          <h2 className="text-[13px] font-semibold">{t("mcp.howToTitle")}</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{t("mcp.howToHint")}</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-[11.5px] leading-relaxed">
            {clientConfig}
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
