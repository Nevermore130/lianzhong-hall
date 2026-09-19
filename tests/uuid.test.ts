import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateUUID } from "../src/lib/uuid";

describe("generateUUID", () => {
  it("生成符合 UUID v4 格式的字符串", () => {
    const uuid = generateUUID();
    
    // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(uuid, uuidPattern, "UUID 应符合 RFC 4122 版本 4 格式");
  });

  it("每次调用生成不同的 UUID", () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    const uuid3 = generateUUID();
    
    assert.notEqual(uuid1, uuid2, "两次生成的 UUID 应该不同");
    assert.notEqual(uuid2, uuid3, "两次生成的 UUID 应该不同");
    assert.notEqual(uuid1, uuid3, "两次生成的 UUID 应该不同");
  });

  it("生成的 UUID 长度为 36 个字符", () => {
    const uuid = generateUUID();
    assert.equal(uuid.length, 36, "UUID 长度应为 36 个字符（包括连字符）");
  });

  it("在 crypto.randomUUID 不可用时使用回退方案", () => {
    // 模拟 crypto.randomUUID 不可用的情况
    const originalRandomUUID = crypto.randomUUID;
    
    try {
      // @ts-expect-error - 故意删除 randomUUID 以测试回退
      delete crypto.randomUUID;
      
      const uuid = generateUUID();
      
      // 即使在回退模式下，也应该生成有效的 UUID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.match(uuid, uuidPattern, "回退方案应生成符合格式的 UUID");
    } finally {
      // 恢复原始方法
      crypto.randomUUID = originalRandomUUID;
    }
  });

  it("在回退模式下生成的 UUID 也是唯一的", () => {
    const originalRandomUUID = crypto.randomUUID;
    
    try {
      // @ts-expect-error - 故意删除 randomUUID 以测试回退
      delete crypto.randomUUID;
      
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      
      assert.notEqual(uuid1, uuid2, "回退模式下生成的 UUID 应该不同");
    } finally {
      crypto.randomUUID = originalRandomUUID;
    }
  });

  it("生成大量 UUID 不会产生碰撞", () => {
    const uuids = new Set<string>();
    const count = 1000;
    
    for (let i = 0; i < count; i++) {
      uuids.add(generateUUID());
    }
    
    assert.equal(uuids.size, count, `生成 ${count} 个 UUID 应该全部唯一`);
  });
});
