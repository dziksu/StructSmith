import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import type { AgentReferenceInput } from "@/lib/agentReference";
import { cn } from "@/lib/utils";
import { useCopyAgentReference } from "./useCopyAgentReference";

export function CopyReferenceButton({
  reference,
  className,
}: {
  reference: AgentReferenceInput;
  className?: string;
}) {
  const { t } = useTranslation();
  const copyReference = useCopyAgentReference();

  return (
    <Tooltip label={t("reference.copy")}>
      <button
        type="button"
        aria-label={t("reference.copy")}
        className={cn(
          "rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          className,
        )}
        onClick={(event) => {
          event.stopPropagation();
          void copyReference(reference);
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}
