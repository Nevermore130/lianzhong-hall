import { useEffect, useRef, useState, type MouseEvent } from "react";
import { getStickerPath, stickerList } from "../lib/stickers";

type EmojiPickerProps = {
  onSelect: (sticker: string) => void;
  onClose: () => void;
};

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [category, setCategory] = useState<keyof typeof stickerList>("常用");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid closing immediately after opening
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleStickerClick = (name: string, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Insert shortcode format [微笑]
    onSelect(`[${name}]`);
    onClose();
  };

  const categories = Object.keys(stickerList) as Array<keyof typeof stickerList>;

  return (
    <div className="emoji-picker" ref={containerRef}>
      <div className="emoji-picker-header">
        <div className="emoji-picker-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={category === cat ? "active" : ""}
              onClick={() => setCategory(cat)}
              type="button"
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          className="emoji-picker-close"
          onClick={onClose}
          type="button"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
      <div className="emoji-picker-grid">
        {stickerList[category].map((name, index) => {
          const path = getStickerPath(name);
          return (
            <button
              key={`${name}-${index}`}
              className="emoji-picker-item"
              onClick={(event) => handleStickerClick(name, event)}
              type="button"
              title={name}
              aria-label={name}
            >
              {path && (
                <img
                  src={path}
                  alt={name}
                  className="sticker-preview"
                  loading="lazy"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
