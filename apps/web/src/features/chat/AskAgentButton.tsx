import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { AgentReferenceInput } from "@/lib/agentReference";
import { useChatStore } from "./store";

export function AskAgentButton({ reference }: { reference: AgentReferenceInput }) {
  const { t } = useTranslation();
  const ask = useChatStore((state) => state.ask);
  return (
    <Tooltip label={t("chat.askAbout")}>
      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        aria-label={t("chat.askAbout")}
        className="h-auto w-auto p-1 text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          ask(reference);
        }}
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </Button>
    </Tooltip>
  );
}
