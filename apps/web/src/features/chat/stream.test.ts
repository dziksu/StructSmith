import { expect, test } from "bun:test";
import type { AgentChatStreamEvent } from "@structsmith/contracts";
import { readChatEvents } from "./stream";

test("SSE decoder preserves fragmented UTF-8, multiline text and event boundaries", async () => {
  const event: AgentChatStreamEvent = {
    type: "message",
    chatId: "c",
    updatedAt: "now",
    message: {
      id: "m",
      role: "assistant",
      text: "Zażółć\nDruga linia",
      reasoning: "Résumé 🧠",
      createdAt: "now",
      provider: "codex",
      status: "running",
    },
  };
  const bytes = new TextEncoder().encode(
    `: heartbeat\n\ndata: ${JSON.stringify(event)}\n\ndata: ${JSON.stringify({ ...event, message: { ...event.message, status: "complete" } })}\n\n`,
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  });
  const events: AgentChatStreamEvent[] = [];
  await readChatEvents(body, (value) => events.push(value));
  expect(events[0]).toEqual(event);
  expect(events[1]).toMatchObject({
    message: { status: "complete", text: event.message.text, reasoning: event.message.reasoning },
  });
});
