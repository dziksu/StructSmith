import type { AgentChatSummary } from "@structsmith/contracts";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TopicActions({
  topic,
  disabled,
  onRename,
  onArchive,
}: {
  topic: AgentChatSummary;
  disabled: boolean;
  onRename: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          className="mr-1 mt-1 shrink-0"
          aria-label={t("chat.topicActions", { name: topic.title || t("chat.untitled") })}
          disabled={disabled || topic.running}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>
          <Pencil className="h-3.5 w-3.5" />
          {t("chat.renameTopic")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchive}>
          {topic.archived ? (
            <ArchiveRestore className="h-3.5 w-3.5" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
          {t(topic.archived ? "chat.restoreTopic" : "chat.archiveTopic")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RenameTopicDialog({
  topic,
  disabled,
  onClose,
  onSave,
}: {
  topic: Pick<AgentChatSummary, "id" | "title">;
  disabled: boolean;
  onClose: () => void;
  onSave: (title: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(topic.title);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !disabled) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("chat.renameTopic")}</DialogTitle>
          <DialogDescription>{t("chat.renameTopicHint")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled && title.trim())
              void onSave(title.trim()).then((saved) => {
                if (saved) onClose();
              });
          }}
        >
          <Label htmlFor="rename-topic-title">{t("chat.topicTitle")}</Label>
          <Input
            id="rename-topic-title"
            className="mt-2"
            value={title}
            maxLength={200}
            required
            disabled={disabled}
            onChange={(event) => setTitle(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={disabled} onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={disabled || !title.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
