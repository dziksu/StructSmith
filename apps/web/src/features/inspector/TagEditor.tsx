import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

export function TagEditor({
  tags,
  onChange,
}: {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  return (
    <div className="space-y-1.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[11px]"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((item) => item !== tag))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={value}
        placeholder={t("inspector.addTag")}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const next = value.trim();
          if (next && !tags.includes(next)) onChange([...tags, next]);
          setValue("");
        }}
      />
    </div>
  );
}
