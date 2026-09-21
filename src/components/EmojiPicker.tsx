import { useEffect, useRef, useState, type MouseEvent } from "react";
import { parseTwemoji, emojiList } from "../lib/twemoji";

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [category, setCategory] = useState<keyof typeof emojiList>("表情");
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

  const handleEmojiClick = (emoji: string, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(emoji);
    onClose();
  };

  const categories = Object.keys(emojiList) as Array<keyof typeof emojiList>;

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
        {emojiList[category].map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            className="emoji-picker-item"
            onClick={(event) => handleEmojiClick(emoji, event)}
            type="button"
            aria-label={emoji}
            dangerouslySetInnerHTML={{ __html: parseTwemoji(emoji) }}
          />
        ))}
      </div>
    </div>
  );
}
