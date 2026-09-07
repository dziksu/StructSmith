import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { type AgentReferenceInput, formatAgentReference } from "@/lib/agentReference";

export function useCopyAgentReference() {
  const { t } = useTranslation();

  return useCallback(
    async (reference: AgentReferenceInput): Promise<void> => {
      try {
        await navigator.clipboard.writeText(formatAgentReference(reference));
        toast.success(t("reference.copied"));
      } catch {
        toast.error(t("reference.copyFailed"));
      }
    },
    [t],
  );
}
