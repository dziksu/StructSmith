import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PropertyEditor({
  properties,
  onChange,
}: {
  properties: Record<string, string>;
  onChange: (properties: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const add = (): void => {
    const trimmed = key.trim();
    if (!trimmed) return;
    onChange({ ...properties, [trimmed]: value });
    setKey("");
    setValue("");
  };

  return (
    <div className="space-y-1.5">
      {Object.entries(properties).map(([propertyKey, propertyValue]) => (
        <div key={propertyKey} className="flex items-center gap-1">
          <Input value={propertyKey} readOnly className="h-7 w-2/5 bg-muted/40" />
          <Input
            value={propertyValue}
            className="h-7 flex-1"
            onChange={(event) => onChange({ ...properties, [propertyKey]: event.target.value })}
          />
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:text-destructive"
            onClick={() => {
              const next = { ...properties };
              delete next[propertyKey];
              onChange(next);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <Input
          value={key}
          placeholder={t("inspector.propertyKey")}
          className="h-7 w-2/5"
          onChange={(event) => setKey(event.target.value)}
        />
        <Input
          value={value}
          placeholder={t("inspector.propertyValue")}
          className="h-7 flex-1"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && add()}
        />
        <Button size="iconSm" variant="ghost" onClick={add}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
