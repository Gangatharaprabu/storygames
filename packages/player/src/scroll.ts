/**
 * Sideways strips (carousel, poster rows, character row, pills) must never stop the page
 * from scrolling. On a Mac trackpad, Chrome locks a whole swipe onto the first scroller
 * that can move, and a "vertical" swipe always has a little sideways movement, so a swipe
 * that starts over a strip gets stuck in it. Here, a mostly-vertical swipe that starts over
 * a strip scrolls the page instead, for the rest of that swipe (the strip moves out from
 * under the pointer as the page scrolls). Sideways swipes still scroll the strip, and a
 * plain mouse wheel (no sideways movement) is left to the browser, which handles it fine.
 */
export const STRIP_SELECTOR = ".featured-track, .rail, .characters, .pills";

/** Wheel events closer together than this belong to the same swipe. */
const GESTURE_GAP_MS = 180;

export function routeVerticalWheelToPage(doc: Document = document) {
  let routingUntil = 0;
  doc.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey) return; // pinch-zoom
      const now = performance.now();
      const vertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
      const continuing = now < routingUntil;
      if (!continuing) {
        const overStrip = (e.target as Element | null)?.closest?.(STRIP_SELECTOR);
        if (!overStrip || !vertical || e.deltaX === 0) return;
      } else if (!vertical) {
        routingUntil = 0;
        return;
      }
      routingUntil = now + GESTURE_GAP_MS;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      window.scrollBy({ top: e.deltaY * unit, behavior: "instant" });
    },
    { passive: false },
  );
}
