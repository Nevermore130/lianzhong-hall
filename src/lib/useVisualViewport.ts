import { useEffect } from "react";

/** Safari's keyboard resizes the visual viewport without resizing 100dvh. */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Let the browser pan and zoom naturally when the user pinch-zooms.
        if (Math.abs(viewport.scale - 1) > 0.01) return;
        root.style.setProperty("--visible-height", `${viewport.height}px`);
        root.style.setProperty("--visible-top", `${viewport.offsetTop}px`);
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.style.removeProperty("--visible-height");
      root.style.removeProperty("--visible-top");
    };
  }, []);
}
