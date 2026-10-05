import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function MessageReasoning({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <Collapsible className="mb-3 rounded-md bg-muted/40">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group h-8 w-full justify-start gap-1.5 px-2 text-xs text-muted-foreground"
        >
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90"
            aria-hidden="true"
          />
          {t("chat.reasoning")}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words px-3 pb-3 text-xs leading-relaxed text-muted-foreground">
          {text}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
