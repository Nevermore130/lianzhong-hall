import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  confirmedOutbox,
  mergeHistory,
  mergeMessages,
  nearBottom,
  restoreOutbox,
} from "../src/lib/chat-state.ts";
import type { ChatMessage, OutgoingMessage } from "../shared/chat.ts";
function message(seq: number): ChatMessage {
  return {
    id: `message-${seq}`,
    seq,
    clientId: randomUUID(),
    channel: "hall",
    userId: "me",
    name: "棋友",
    text: `消息${seq}`,
    time: seq,
  };
}
test("late receipts and paginated/repeated snapshots merge chronologically without duplicates", () => {
  const first = message(1),
    second = message(2),
    third = message(3);
  assert.deepEqual(mergeMessages([second, third], [first, second]), [
    first,
    second,
    third,
  ]);
  assert.deepEqual(
    mergeHistory(
      { messages: [first, second], hasMore: false },
      { channel: "hall", messages: [second, third], hasMore: true, unread: 0 },
    ),
    { messages: [first, second, third], hasMore: false },
  );
});
test("reconnect gaps retain a usable older-history cursor instead of silently joining disjoint ranges", () => {
  const latest = [message(90), message(91)];
  const result = mergeHistory(
    { messages: [message(1), message(2)], hasMore: false },
    { channel: "hall", messages: latest, hasMore: true, unread: 89 },
  );
  assert.deepEqual(result, { messages: latest, hasMore: true });
});
test("outbox confirmation is scoped to the sender; refreshed pending messages keep original ids and text for safe retry", () => {
  const sent = message(1);
  const pending: OutgoingMessage = {
    clientId: sent.clientId,
    channel: "hall",
    text: sent.text,
    time: 1,
    status: "sending",
  };
  assert.equal(
    confirmedOutbox([pending], [{ ...sent, userId: "someone-else" }], "me")
      .length,
    1,
  );
  assert.deepEqual(confirmedOutbox([pending], [sent], "me"), []);
  const restored = restoreOutbox(JSON.stringify([pending]));
  assert.equal(restored[0].clientId, pending.clientId);
  assert.equal(restored[0].status, "failed");
  assert.equal(restored[0].text, pending.text);
  assert.deepEqual(restoreOutbox("broken json"), []);
  assert.deepEqual(restoreOutbox('[{"text":"invalid"}]'), []);
});
test("scroll pinning distinguishes readers above the bottom, including fractional scroll positions", () => {
  assert.equal(nearBottom(0, 500, 100), false);
  assert.equal(nearBottom(399.5, 500, 100), true);
  assert.equal(nearBottom(0, 50, 100), true);
});
