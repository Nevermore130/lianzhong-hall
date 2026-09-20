/**
 * 游戏背景音乐系统 - 使用 HTML Audio 元素播放循环音乐
 */

export type BGMTrack = "gomoku" | "xiangqi" | "doudizhu" | "mahjong" | null;

const BGM_FILES: Record<Exclude<BGMTrack, null>, string> = {
  gomoku: "/assets/bgm/fools-philosophy-v2.ogg",
  xiangqi: "/assets/bgm/fools-philosophy-v2.ogg",
  doudizhu: "/assets/bgm/cozy-puzzle-v2.ogg",
  mahjong: "/assets/bgm/mahjongg-nes-v2.ogg",
};

export class BGMManager {
  private audio: HTMLAudioElement | null = null;
  private enabled: boolean;
  private currentTrack: BGMTrack = null;
  private fadingOut = false;
  private fadeInterval: number | null = null;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /**
   * 启用或禁用背景音乐
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * 获取当前音乐状态
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 播放指定游戏的背景音乐
   */
  play(track: BGMTrack): void {
    if (!this.enabled || track === null) {
      this.stop();
      return;
    }

    if (this.currentTrack === track && this.audio && !this.audio.paused) {
      return;
    }

    this.currentTrack = track;
    this.fadingOut = false;

    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    try {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.loop = true;
      }

      const file = BGM_FILES[track];
      if (this.audio.src.endsWith(file)) {
        if (this.audio.paused) {
          void this.audio.play();
          this.fadeIn();
        }
      } else {
        this.audio.src = file;
        this.audio.volume = 0;
        void this.audio.play();
        this.fadeIn();
      }
    } catch {
      // Audio is optional; failures are silently ignored
    }
  }

  /**
   * 停止播放背景音乐
   */
  stop(): void {
    this.currentTrack = null;
    if (!this.audio || this.audio.paused) return;

    this.fadeOut(() => {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
    });
  }

  /**
   * 淡入效果
   */
  private fadeIn(): void {
    if (!this.audio) return;

    const targetVolume = 0.25;
    const step = 0.02;
    const interval = 50;

    this.audio.volume = 0;

    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval);
    }

    this.fadeInterval = window.setInterval(() => {
      if (!this.audio || this.fadingOut) {
        if (this.fadeInterval !== null) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        return;
      }

      if (this.audio.volume < targetVolume) {
        this.audio.volume = Math.min(this.audio.volume + step, targetVolume);
      } else {
        if (this.fadeInterval !== null) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
      }
    }, interval);
  }

  /**
   * 淡出效果
   */
  private fadeOut(callback?: () => void): void {
    if (!this.audio) {
      callback?.();
      return;
    }

    this.fadingOut = true;
    const step = 0.04;
    const interval = 50;

    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval);
    }

    this.fadeInterval = window.setInterval(() => {
      if (!this.audio) {
        if (this.fadeInterval !== null) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        callback?.();
        return;
      }

      if (this.audio.volume > step) {
        this.audio.volume = Math.max(this.audio.volume - step, 0);
      } else {
        this.audio.volume = 0;
        if (this.fadeInterval !== null) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        this.fadingOut = false;
        callback?.();
      }
    }, interval);
  }

  /**
   * 解锁音频（需要在用户手势后调用）
   */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.loop = true;
        this.audio.volume = 0;
      }
      void this.audio.play().then(() => {
        if (this.audio) this.audio.pause();
      });
    } catch {
      // Audio is optional
    }
  }
}

/**
 * 从 localStorage 读取音乐设置
 */
export function loadMusicSetting(): boolean {
  try {
    const value = localStorage.getItem("hall:music");
    return value === "on";
  } catch {
    return false;
  }
}

/**
 * 保存音乐设置到 localStorage
 */
export function saveMusicSetting(enabled: boolean): void {
  try {
    localStorage.setItem("hall:music", enabled ? "on" : "off");
  } catch {
    // Optional preference storage
  }
}
