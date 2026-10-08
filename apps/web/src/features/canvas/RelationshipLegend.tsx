import { useTranslation } from "react-i18next";
import type { FlowEdge } from "./graph";
import { relationshipLineStyle } from "./RelationshipEdge";

export function RelationshipLegend({ edges }: { edges: readonly FlowEdge[] }) {
  const { t } = useTranslation();
  const entries = new Map<string, NonNullable<FlowEdge["data"]>["placement"]>();
  for (const edge of edges) {
    const placement = edge.data?.placement;
    if (placement?.legendLabel) {
      const rendered = {
        ...placement,
        lineStyle: relationshipLineStyle(
          edge.data?.relationship.interactionStyle ?? "sync",
          placement.lineStyle,
        ),
        strokeWidth: placement.strokeWidth ?? (edge.data?.implied ? 1.1 : 1.4),
      };
      entries.set(
        JSON.stringify([
          rendered.legendLabel,
          rendered.color,
          rendered.lineStyle,
          rendered.strokeWidth,
        ]),
        rendered,
      );
    }
  }
  if (entries.size === 0) return null;
  return (
    <aside
      aria-label={t("relationshipPresentation.legend")}
      className="pointer-events-none absolute bottom-3 left-14 max-w-[240px] rounded-md border border-border bg-card/95 p-2 text-[11px] shadow-sm"
    >
      <div className="mb-1 font-semibold">{t("relationshipPresentation.legend")}</div>
      <ul className="space-y-1">
        {[...entries].map(([key, placement]) => (
          <li key={key} className="flex items-center gap-2">
            <svg aria-hidden="true" width="32" height="12" className="shrink-0">
              <path
                d="M1,6 L31,6"
                stroke={placement?.color ?? "var(--edge)"}
                strokeWidth={placement?.strokeWidth ?? 1.4}
                strokeDasharray={
                  placement?.lineStyle === "dashed"
                    ? "5 4"
                    : placement?.lineStyle === "dotted"
                      ? "1 4"
                      : undefined
                }
              />
            </svg>
            <span className="break-words">{placement?.legendLabel}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
