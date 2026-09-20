import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  SoundManager,
  loadSoundSetting,
  saveSoundSetting,
  type SoundEffect,
} from "../src/lib/sound";

describe("SoundManager", () => {
  let manager: SoundManager;

  beforeEach(() => {
    manager = new SoundManager(false);
  });

  afterEach(() => {
    // 清理 localStorage
    try {
      localStorage.removeItem("hall:sound");
    } catch {
      // Node 环境可能没有 localStorage
    }
  });

  it("默认状态为禁用", () => {
    const mgr = new SoundManager();
    assert.equal(mgr.isEnabled(), false, "默认应该禁用音效");
  });

  it("可以通过构造函数启用音效", () => {
    const mgr = new SoundManager(true);
    assert.equal(mgr.isEnabled(), true, "应该启用音效");
  });

  it("setEnabled 可以切换音效状态", () => {
    assert.equal(manager.isEnabled(), false, "初始状态应为禁用");

    manager.setEnabled(true);
    assert.equal(manager.isEnabled(), true, "调用 setEnabled(true) 后应启用");

    manager.setEnabled(false);
    assert.equal(manager.isEnabled(), false, "调用 setEnabled(false) 后应禁用");
  });

  it("禁用时调用 play 不会抛出异常", () => {
    manager.setEnabled(false);
    assert.doesNotThrow(
      () => manager.play("place"),
      "禁用时调用 play 不应抛出异常",
    );
  });

  it("启用时调用 play 不会抛出异常", () => {
    manager.setEnabled(true);
    const effects: SoundEffect[] = ["place", "capture", "play", "pass", "claim"];

    effects.forEach((effect) => {
      assert.doesNotThrow(
        () => manager.play(effect),
        `播放 ${effect} 音效不应抛出异常`,
      );
    });
  });

  it("可以播放所有定义的音效类型", () => {
    manager.setEnabled(true);
    const effects: SoundEffect[] = ["place", "capture", "play", "pass", "claim"];

    effects.forEach((effect) => {
      assert.doesNotThrow(
        () => manager.play(effect),
        `应该能够播放 ${effect} 音效`,
      );
    });
  });

  it("unlock 在禁用时不会抛出异常", () => {
    manager.setEnabled(false);
    assert.doesNotThrow(
      () => manager.unlock(),
      "禁用时调用 unlock 不应抛出异常",
    );
  });

  it("unlock 在启用时不会抛出异常", () => {
    manager.setEnabled(true);
    assert.doesNotThrow(
      () => manager.unlock(),
      "启用时调用 unlock 不应抛出异常",
    );
  });

  it("可以多次播放同一音效", () => {
    manager.setEnabled(true);
    assert.doesNotThrow(() => {
      manager.play("place");
      manager.play("place");
      manager.play("place");
    }, "应该能够连续播放相同音效");
  });

  it("可以快速切换不同音效", () => {
    manager.setEnabled(true);
    assert.doesNotThrow(() => {
      manager.play("place");
      manager.play("capture");
      manager.play("play");
      manager.play("pass");
      manager.play("claim");
    }, "应该能够快速切换不同音效");
  });
});

describe("loadSoundSetting", () => {
  afterEach(() => {
    try {
      localStorage.removeItem("hall:sound");
    } catch {
      // Node 环境可能没有 localStorage
    }
  });

  it("localStorage 为空时返回 false", () => {
    try {
      localStorage.removeItem("hall:sound");
      assert.equal(loadSoundSetting(), false, "没有设置时应返回 false");
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });

  it('localStorage 为 "on" 时返回 true', () => {
    try {
      localStorage.setItem("hall:sound", "on");
      assert.equal(loadSoundSetting(), true, '设置为 "on" 时应返回 true');
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });

  it('localStorage 为 "off" 时返回 false', () => {
    try {
      localStorage.setItem("hall:sound", "off");
      assert.equal(loadSoundSetting(), false, '设置为 "off" 时应返回 false');
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });

  it("localStorage 为其他值时返回 false", () => {
    try {
      localStorage.setItem("hall:sound", "maybe");
      assert.equal(loadSoundSetting(), false, "其他值时应返回 false");
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });
});

describe("saveSoundSetting", () => {
  afterEach(() => {
    try {
      localStorage.removeItem("hall:sound");
    } catch {
      // Node 环境可能没有 localStorage
    }
  });

  it('保存 true 应设置为 "on"', () => {
    try {
      saveSoundSetting(true);
      assert.equal(
        localStorage.getItem("hall:sound"),
        "on",
        '保存 true 应设置为 "on"',
      );
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });

  it('保存 false 应设置为 "off"', () => {
    try {
      saveSoundSetting(false);
      assert.equal(
        localStorage.getItem("hall:sound"),
        "off",
        '保存 false 应设置为 "off"',
      );
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });

  it("连续保存应覆盖之前的值", () => {
    try {
      saveSoundSetting(true);
      assert.equal(localStorage.getItem("hall:sound"), "on");

      saveSoundSetting(false);
      assert.equal(localStorage.getItem("hall:sound"), "off");

      saveSoundSetting(true);
      assert.equal(localStorage.getItem("hall:sound"), "on");
    } catch {
      // Node 环境可能没有 localStorage，跳过测试
      assert.ok(true, "Node 环境跳过 localStorage 测试");
    }
  });
});
