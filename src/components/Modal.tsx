import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      onClose.current();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`retro-dialog ${wide ? "wide" : ""}`}
      aria-label={title}
    >
      <div className="window-title">
        <span>▣ &nbsp; {title}</span>
        <button aria-label="关闭弹窗" onClick={close}>
          <X size={14} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
