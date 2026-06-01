# Feature Spec: Auto-Hiding Bottom Navigation Bar

**Goal:** The bottom navigation bar (Home, Songs, [+], Plans, Settings) should stay fixed and always accessible — but intelligently hide when the user scrolls DOWN (reading content) and reappear when they scroll UP (looking for navigation). This is the same pattern used by Chrome mobile, Instagram, and most modern mobile apps.

**Problem today:** The bottom nav is part of the page flow, so on long pages (song lists, lineups) the user must scroll all the way to the bottom to reach the menu. This is poor UX.

---

## Current State (from screenshots)

- Bottom nav exists with 5 items: HOME, SONGS, [+] (center FAB), PLANS, SETTINGS
- It appears to be `position: fixed` already OR at the bottom of page flow
- On the song list screen, the user scrolls through many song cards before reaching navigation

## Desired Behavior

| User action | Nav bar behavior |
|-------------|------------------|
| Page loads | Nav bar VISIBLE |
| Scrolling DOWN (reading content) | Nav bar slides DOWN and hides (after ~10px scroll) |
| Scrolling UP (even slightly) | Nav bar slides UP and reappears immediately |
| At the very top of the page | Nav bar always VISIBLE |
| Idle / stopped scrolling | Nav bar stays in current state (don't auto-show on idle — that's jarring) |
| Tapping a nav item | Works normally regardless of visibility |

---

## Implementation Requirements

### 1. Find the bottom nav component
Locate the existing bottom navigation component. Based on the screenshots it has: Home (with badge), Songs, a center [+] FAB, Plans, Settings. Likely in `src/components/` — search for "BottomNav", "Navbar", "bottom-nav", or the nav item labels.

### 2. Make it fixed (if not already)
The nav must be `position: fixed; bottom: 0; left: 0; right: 0;` with a high `z-index` (e.g. `z-50`) so it floats above page content.

### 3. Add scroll-direction detection
Create a custom React hook `useScrollDirection` that:
- Tracks `window.scrollY` (or the scroll container's scrollTop)
- Compares current scroll position to the previous one
- Returns `'up'` or `'down'`
- Uses a small threshold (~8-10px) to avoid jitter from tiny scrolls
- Throttles with `requestAnimationFrame` for performance (do NOT fire on every scroll event)

```jsx
// src/hooks/useScrollDirection.js
import { useState, useEffect, useRef } from 'react';

export function useScrollDirection({ threshold = 10, topOffset = 50 } = {}) {
  const [direction, setDirection] = useState('up'); // 'up' = show, 'down' = hide
  const [atTop, setAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateDirection = () => {
      const scrollY = window.scrollY;

      // Always show near the top
      if (scrollY < topOffset) {
        setAtTop(true);
        setDirection('up');
        lastScrollY.current = scrollY;
        ticking.current = false;
        return;
      }
      setAtTop(false);

      // Only change direction if scrolled more than threshold
      if (Math.abs(scrollY - lastScrollY.current) < threshold) {
        ticking.current = false;
        return;
      }

      setDirection(scrollY > lastScrollY.current ? 'down' : 'up');
      lastScrollY.current = scrollY > 0 ? scrollY : 0;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topOffset]);

  return { direction, atTop, isVisible: direction === 'up' || atTop };
}
```

### 4. Apply the hide/show animation to the nav
In the bottom nav component, use the hook and translate the bar in/out with a CSS transition:

```jsx
import { useScrollDirection } from '../hooks/useScrollDirection';

function BottomNav() {
  const { isVisible } = useScrollDirection();

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* existing nav items unchanged */}
    </nav>
  );
}
```

Key points:
- `translate-y-0` = visible, `translate-y-full` = slid completely off the bottom edge
- `transition-transform duration-300 ease-in-out` = smooth slide animation
- `env(safe-area-inset-bottom)` = respects the phone's gesture bar / notch area
- Keep `backdrop-blur` and the semi-transparent background for the modern floating look

### 5. Add bottom padding to page content
Because the nav is now `fixed` (floating over content), the last items on each page could be hidden behind it. Add bottom padding equal to the nav height (~64-80px) to the main scrollable container:

```jsx
// On the main content wrapper / page-shell:
className="... pb-20"  // or pb-24 — enough to clear the fixed nav
```

This ensures the last song card or list item isn't covered by the floating nav.

### 6. The center [+] FAB
The center [+] floating action button should hide/show WITH the nav bar (it's part of the same component). Don't make it a separate floating element that stays while the bar hides — that looks broken. Keep them together.

---

## Edge Cases to Handle

1. **Short pages that don't scroll** — nav should always be visible (no scroll = no hide trigger). The `atTop` check handles this.

2. **Scroll containers** — if the app scrolls inside a specific `<div>` rather than `window`, the hook needs to attach to that element's scroll event instead of `window`. Check how the app currently scrolls. If pages use an inner scroll container (e.g. `overflow-y-auto` on a div), adapt the hook to accept a ref to that container.

3. **Modals / overlays** — when a modal is open, the nav hiding shouldn't interfere. Fixed positioning with proper z-index handles this, but verify the nav doesn't float above open modals (modal z-index should be higher than nav's z-50, e.g. z-[100]).

4. **Pull-to-refresh / bounce** — on iOS-style bounce scrolling, negative scrollY can occur. The `scrollY > 0 ? scrollY : 0` guard handles this.

---

## What NOT to do

- ❌ Do NOT auto-show the nav on idle timer — only show on scroll-up or at-top. Idle-show is jarring.
- ❌ Do NOT use a scroll listener without `requestAnimationFrame` throttling — it kills performance.
- ❌ Do NOT remove the nav from the DOM when hidden — just translate it off-screen so the transition is smooth and tap targets remain mounted.
- ❌ Do NOT change the nav's appearance, icons, labels, or the badge — only add the hide/show behavior.

---

## Acceptance Criteria (how to verify)

1. ✅ Open the Songs page (long list). Nav is visible at top.
2. ✅ Scroll down through songs → nav slides away smoothly.
3. ✅ Scroll up even a little → nav slides back immediately.
4. ✅ Scroll to the very top → nav stays visible.
5. ✅ Last song card is NOT hidden behind the nav (proper bottom padding).
6. ✅ Center [+] FAB hides/shows together with the bar.
7. ✅ No jitter or flickering during normal scrolling.
8. ✅ Animation is smooth (~300ms slide).
9. ✅ Works on both the Dashboard/Home and Songs pages.

---

## Files Likely Touched

- `src/hooks/useScrollDirection.js` — NEW (the hook)
- `src/components/BottomNav.jsx` (or wherever the nav lives) — add hook + transform classes
- `src/App.jsx` or page-shell components — add `pb-20`/`pb-24` bottom padding to scrollable content

---

## Implementation Steps for the Agent

1. **Find** the bottom nav component and confirm its current positioning (fixed vs in-flow). Report what you find.
2. **Determine** the scroll mechanism — does the app scroll on `window` or inside a container div? This decides how the hook attaches.
3. **Create** `src/hooks/useScrollDirection.js` (adapt to window vs container as needed).
4. **Apply** the hook + transform classes to the bottom nav component.
5. **Add** bottom padding to page content so nothing hides behind the nav.
6. **Run** `npm run build` to confirm it compiles.
7. **Do NOT push yet** — the user will test on the Xiaomi first (build APK, install, scroll the Songs page).

---

## Notes

- This is a pure front-end / UX change. No backend, database, or API changes.
- Match the existing dark slate theme — don't introduce new colors.
- Keep the change minimal and focused. Only the nav's visibility behavior changes; everything else stays identical.
