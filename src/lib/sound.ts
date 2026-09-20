/**
 * 游戏音效系统 - 使用 Web Audio API 合成各种游戏操作音效
 */

export type SoundEffect =
  | "place" // 放置棋子/麻将
  | "capture" // 吃子
  | "play" // 出牌
  | "pass" // 过牌/不出
  | "claim"; // 叫地主/胡牌

interface SoundConfig {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
  ramp?: boolean;
}

const SOUND_PROFILES: Record<SoundEffect, SoundConfig> = {
  place: {
    frequency: 660,
    duration: 0.15,
    gain: 0.055,
    type: "sine",
    ramp: true,
  },
  capture: {
    frequency: 520,
    duration: 0.2,
    gain: 0.08,
    type: "square",
    ramp: true,
  },
  play: {
    frequency: 440,
    duration: 0.12,
    gain: 0.05,
    type: "sine",
    ramp: false,
  },
  pass: {
    frequency: 330,
    duration: 0.1,
    gain: 0.04,
    type: "sine",
    ramp: false,
  },
  claim: {
    frequency: 880,
    duration: 0.25,
    gain: 0.1,
    type: "triangle",
    ramp: true,
  },
};

export class SoundManager {
  private context: AudioContext | null = null;
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * 启用或禁用音效
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 获取当前音效状态
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 播放指定的音效
   */
  play(effect: SoundEffect): void {
    if (!this.enabled) return;

    try {
      this.context ??= new AudioContext();
      void this.context.resume();

      const config = SOUND_PROFILES[effect];
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();

      oscillator.type = config.type;
      oscillator.frequency.value = config.frequency;

      if (config.ramp) {
        gain.gain.setValueAtTime(config.gain, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          this.context.currentTime + config.duration * 0.93,
        );
      } else {
        gain.gain.setValueAtTime(config.gain, this.context.currentTime);
        gain.gain.setValueAtTime(
          0,
          this.context.currentTime + config.duration,
        );
      }

      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + config.duration);
    } catch {
      // Audio is optional; failures are silently ignored
    }
  }

  /**
   * 解锁 AudioContext（需要在用户手势后调用）
   */
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
    } catch {
      // Audio is optional
    }
  }
}

/**
 * 从 localStorage 读取音效设置
 */
export function loadSoundSetting(): boolean {
  try {
    return localStorage.getItem("hall:sound") === "on";
  } catch {
    return false;
  }
}

/**
 * 保存音效设置到 localStorage
 */
export function saveSoundSetting(enabled: boolean): void {
  try {
    localStorage.setItem("hall:sound", enabled ? "on" : "off");
  } catch {
    // Optional preference storage
  }
}
