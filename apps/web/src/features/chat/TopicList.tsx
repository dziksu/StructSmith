import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AgentChatSummary } from "@structsmith/contracts";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { providerNames } from "./AgentSettingsDialog";
import { TopicActions } from "./TopicActions";

function TopicContent({ topic }: { topic: AgentChatSummary }) {
  const { t } = useTranslation();
  return (
    <>
      <span className="flex w-full items-center gap-1 text-xs font-medium">
        {topic.running && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
        <span className="truncate" title={topic.title || t("chat.untitled")}>
          {topic.title || t("chat.untitled")}
        </span>
      </span>
      <span className="mt-1 block w-full truncate text-[10px] text-muted-foreground">
        {topic.workspaceName ?? t("chat.general")}
      </span>
      <span className="text-[10px] text-muted-foreground">{providerNames[topic.provider]}</span>
    </>
  );
}

interface TopicListProps {
  topics: AgentChatSummary[];
  activeId: string | null;
  disabled: boolean;
  reordering: boolean;
  onChoose: (id: string) => void;
  onRename: (topic: AgentChatSummary) => void;
  onArchive: (topic: AgentChatSummary) => void;
  onReorder: (topicIds: string[]) => Promise<void>;
}

function SortableTopic({
  topic,
  selected,
  disabled,
  reordering,
  onChoose,
  onRename,
  onArchive,
}: {
  topic: AgentChatSummary;
  selected: boolean;
} & Pick<TopicListProps, "disabled" | "reordering" | "onChoose" | "onRename" | "onArchive">) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id, disabled: disabled || reordering });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "mb-1 flex rounded-md hover:bg-accent",
        selected && "bg-accent",
        isDragging && "opacity-30",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        type="button"
        variant="ghost"
        disabled={disabled}
        aria-disabled={disabled}
        onClick={() => onChoose(topic.id)}
        aria-pressed={selected}
        aria-roledescription={t("chat.sortableTopic")}
        title={t("chat.reorderHint")}
        className="h-auto min-w-0 flex-1 touch-pan-y select-none cursor-grab flex-col items-start gap-0 p-2 text-left active:cursor-grabbing"
      >
        <TopicContent topic={topic} />
      </Button>
      <TopicActions
        topic={topic}
        disabled={disabled || reordering}
        onRename={() => onRename(topic)}
        onArchive={() => onArchive(topic)}
      />
    </div>
  );
}

export function TopicList({ topics, activeId, disabled, onReorder, ...actions }: TopicListProps) {
  const { t } = useTranslation();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 350, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dragged = topics.find((topic) => topic.id === draggedId);
  const name = (id: string | number) =>
    topics.find((topic) => topic.id === id)?.title || t("chat.untitled");
  const position = (id: string | number) => topics.findIndex((topic) => topic.id === id) + 1;
  const finish = ({ active, over }: DragEndEvent) => {
    setDraggedId(null);
    if (!over || active.id === over.id) return;
    const from = topics.findIndex((topic) => topic.id === active.id);
    const to = topics.findIndex((topic) => topic.id === over.id);
    if (from < 0 || to < 0) return;
    void onReorder(arrayMove(topics, from, to).map((topic) => topic.id));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setDraggedId(String(active.id))}
      onDragCancel={() => setDraggedId(null)}
      onDragEnd={finish}
      accessibility={{
        screenReaderInstructions: { draggable: t("chat.reorderInstructions") },
        announcements: {
          onDragStart: ({ active }) => t("chat.reorderStarted", { name: name(active.id) }),
          onDragOver: ({ active, over }) =>
            over
              ? t("chat.reorderMoved", {
                  name: name(active.id),
                  position: position(over.id),
                  total: topics.length,
                })
              : undefined,
          onDragEnd: ({ active, over }) =>
            over
              ? t("chat.reorderDropped", {
                  name: name(active.id),
                  position: position(over.id),
                  total: topics.length,
                })
              : t("chat.reorderCancelled", { name: name(active.id) }),
          onDragCancel: ({ active }) => t("chat.reorderCancelled", { name: name(active.id) }),
        },
      }}
    >
      <SortableContext
        items={topics.map((topic) => topic.id)}
        strategy={verticalListSortingStrategy}
      >
        {topics.map((topic) => (
          <SortableTopic
            key={topic.id}
            topic={topic}
            selected={topic.id === activeId}
            disabled={disabled}
            {...actions}
          />
        ))}
      </SortableContext>
      {createPortal(
        <DragOverlay>
          {dragged && (
            <div className="flex rounded-md bg-accent shadow-lg ring-1 ring-primary">
              <div className="flex min-w-0 flex-1 cursor-grabbing flex-col items-start gap-0 p-2 pr-10 text-left">
                <TopicContent topic={dragged} />
              </div>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
