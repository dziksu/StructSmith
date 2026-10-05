import type { AgentChat } from "@structsmith/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { chatApi } from "./api";

export function useChatStream(id: string | null, enabled: boolean): boolean {
  const cache = useQueryClient();
  const [connectedId, setConnectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !id) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    const connect = async () => {
      try {
        await chatApi.events(id, controller.signal, (event) => {
          if (controller.signal.aborted) return;
          if (event.type === "snapshot") {
            // Cancel a slower HTTP read before installing the newer stream snapshot.
            void cache.cancelQueries({ queryKey: ["agent-chat", id] });
            setConnectedId(id);
            delay = 1000;
            cache.setQueryData(["agent-chat", id], event.chat);
            void cache.invalidateQueries({ queryKey: ["agent-chats"] });
          } else {
            cache.setQueryData<AgentChat>(
              ["agent-chat", id],
              (chat) =>
                chat && {
                  ...chat,
                  updatedAt: event.updatedAt,
                  messages: chat.messages.map((message) =>
                    message.id === event.message.id ? event.message : message,
                  ),
                },
            );
            if (event.message.status !== "running")
              void cache.invalidateQueries({ queryKey: ["agent-chats"] });
          }
        });
      } catch {
        // Polling remains available during connection failures, including token authentication errors.
      }
      if (!controller.signal.aborted) {
        setConnectedId(null);
        retry = setTimeout(() => void connect(), delay);
        delay = Math.min(delay * 2, 10000);
      }
    };
    void connect();
    return () => {
      controller.abort();
      clearTimeout(retry);
      setConnectedId(null);
    };
  }, [cache, enabled, id]);
  return enabled && Boolean(id) && connectedId === id;
}
