import { type AgentChatStreamEvent, AgentChatStreamEventSchema } from "@structsmith/contracts";

/** Our SSE endpoint writes one JSON data line per event; TextDecoder preserves split UTF-8. */
export async function readChatEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AgentChatStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: "))
          onEvent(AgentChatStreamEventSchema.parse(JSON.parse(line.slice(6))));
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
