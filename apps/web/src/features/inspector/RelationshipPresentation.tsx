import type { AttachmentSide, ViewDetail, ViewRelationshipPatch } from "@structsmith/contracts";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApplyOperations } from "@/hooks/useApi";

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  step?: number | "any";
  onCommit: (value: number | null) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={(event) => {
          if (!event.currentTarget.reportValidity()) return;
          const next = draft === "" ? null : Number(draft);
          if (next !== (value ?? null)) onCommit(next);
        }}
      />
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: readonly string[];
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? "auto"}
        onValueChange={(next) => onChange(next === "auto" ? null : next)}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["auto", ...options].map((option) => (
            <SelectItem key={option} value={option}>
              {t(`relationshipPresentation.options.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RelationshipPresentation({
  view,
  relationshipId,
}: {
  view: ViewDetail;
  relationshipId: string;
}) {
  const { t } = useTranslation();
  const apply = useApplyOperations(view.workspaceId);
  const placement = view.relationships.find((entry) => entry.relationshipId === relationshipId);
  const [color, setColor] = useState(placement?.color ?? "");
  const [legend, setLegend] = useState(placement?.legendLabel ?? "");
  const colorId = useId();
  const legendId = useId();
  useEffect(() => {
    setColor(placement?.color ?? "");
    setLegend(placement?.legendLabel ?? "");
  }, [placement?.color, placement?.legendLabel]);
  const patch = (fields: Omit<ViewRelationshipPatch, "relationshipId">) =>
    apply.mutate({
      label: t("relationshipPresentation.updated"),
      operations: [
        {
          op: "setViewRelationships",
          viewId: view.id,
          relationships: [{ relationshipId, ...fields }],
        },
      ],
    });
  return (
    <section
      className="space-y-3 border-t border-border pt-3"
      aria-label={t("relationshipPresentation.title")}
    >
      <h3 className="text-xs font-semibold">{t("relationshipPresentation.title")}</h3>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t("relationshipPresentation.help")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Choice
          label={t("relationshipPresentation.sourceSide")}
          value={placement?.sourceSide}
          options={["top", "right", "bottom", "left"]}
          onChange={(sourceSide) => patch({ sourceSide: sourceSide as AttachmentSide | null })}
        />
        <Choice
          label={t("relationshipPresentation.targetSide")}
          value={placement?.targetSide}
          options={["top", "right", "bottom", "left"]}
          onChange={(targetSide) => patch({ targetSide: targetSide as AttachmentSide | null })}
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t("relationshipPresentation.attachmentsHelp")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={colorId}>{t("relationshipPresentation.color")}</Label>
          <Input
            id={colorId}
            value={color}
            placeholder="#22c55e"
            maxLength={7}
            pattern="#[0-9a-fA-F]{6}"
            onChange={(event) => setColor(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            onBlur={(event) => {
              if (
                event.currentTarget.reportValidity() &&
                (color || null) !== (placement?.color ?? null)
              )
                patch({ color: color || null });
            }}
          />
        </div>
        <NumberField
          label={t("relationshipPresentation.strokeWidth")}
          value={placement?.strokeWidth}
          min={0.5}
          max={8}
          step={0.1}
          onCommit={(strokeWidth) => patch({ strokeWidth })}
        />
      </div>
      <Choice
        label={t("relationshipPresentation.lineStyle")}
        value={placement?.lineStyle}
        options={["solid", "dashed", "dotted"]}
        onChange={(lineStyle) =>
          patch({ lineStyle: lineStyle as ViewRelationshipPatch["lineStyle"] })
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Choice
          label={t("relationshipPresentation.startArrow")}
          value={placement?.startArrow}
          options={["none", "open", "closed"]}
          onChange={(startArrow) =>
            patch({ startArrow: startArrow as ViewRelationshipPatch["startArrow"] })
          }
        />
        <Choice
          label={t("relationshipPresentation.endArrow")}
          value={placement?.endArrow}
          options={["none", "open", "closed"]}
          onChange={(endArrow) =>
            patch({ endArrow: endArrow as ViewRelationshipPatch["endArrow"] })
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={legendId}>{t("relationshipPresentation.legendLabel")}</Label>
        <Input
          id={legendId}
          value={legend}
          maxLength={80}
          onChange={(event) => setLegend(event.target.value)}
          onBlur={() => {
            const next = legend.trim() || null;
            if (next !== (placement?.legendLabel ?? null)) patch({ legendLabel: next });
          }}
        />
      </div>
      <NumberField
        label={t("relationshipPresentation.labelPosition")}
        value={placement?.labelPosition}
        min={0}
        max={1}
        step={0.01}
        onCommit={(labelPosition) => patch({ labelPosition })}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t("relationshipPresentation.offsetX")}
          value={placement?.labelOffset?.x ?? 0}
          step="any"
          onCommit={(x) => patch({ labelOffset: { x: x ?? 0, y: placement?.labelOffset?.y ?? 0 } })}
        />
        <NumberField
          label={t("relationshipPresentation.offsetY")}
          value={placement?.labelOffset?.y ?? 0}
          step="any"
          onCommit={(y) => patch({ labelOffset: { x: placement?.labelOffset?.x ?? 0, y: y ?? 0 } })}
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t("relationshipPresentation.labelHelp")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => patch({ labelPosition: null, labelOffset: null })}
      >
        {t("relationshipPresentation.resetLabel")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() =>
          patch({
            sourceSide: null,
            targetSide: null,
            color: null,
            strokeWidth: null,
            lineStyle: null,
            startArrow: null,
            endArrow: null,
            legendLabel: null,
            labelPosition: null,
            labelOffset: null,
            controlPoints: [],
          })
        }
      >
        {t("relationshipPresentation.resetAll")}
      </Button>
    </section>
  );
}
