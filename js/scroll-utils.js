// ==========================================
// SCROLL UTILITIES
// ==========================================
// Three unrelated-looking helpers that share one theme: keeping the right
// thing visible without letting the browser's own "helpful" scrolling
// defaults scroll the wrong thing instead (the whole page, when only a
// pill row should move; nothing at all, until a keyboard finishes opening).

// Horizontally centers `btn` inside `container`'s own scroll position —
// deliberately touches nothing but container.scrollLeft, so it can never
// cascade into scrolling the page. This replaced Element.scrollIntoView()
// in both the task and habit filter rows: those rows only scroll
// horizontally, so scrollIntoView's vertical "nearest" component had
// nowhere to resolve except the page itself — if the row wasn't fully
// inside the viewport (routine on mobile, where a panel above it can push
// it near/past the fold), the browser would scroll the whole page to
// satisfy it, on every load since these run during initial render, not
// just on click.
export function centerButtonInScrollArea(container, btn) {
  if (!container || !btn) {return;}
  const target = btn.offsetLeft - (container.clientWidth / 2) + (btn.offsetWidth / 2);
  container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
}

// Horizontal wheel scroll for filter bars (desktop) — a vertical mouse
// wheel over a horizontally-scrolling row does nothing by default, since
// the row has no vertical overflow for the wheel event to act on.
export function setupHorizontalWheelScroll(container) {
  if (!container) {return;}
  container.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

/*
  Keeps a bottom-of-page text input visible when the on-screen keyboard
  opens on mobile. The layout viewport (what `vh`/`dvh` are computed
  against on most mobile browsers) doesn't shrink when the keyboard
  appears — only the *visual* viewport does — so a naive check made at
  focus time has no idea yet how much space the keyboard is about to
  take. window.visualViewport's 'resize' event fires once the keyboard
  has actually finished animating in and the visual viewport has its
  real post-keyboard size, which is the right moment to act: scrolling
  any earlier just guesses.
*/
export function keepInputVisibleOnMobileKeyboard(inputEl) {
  if (!inputEl || !window.visualViewport) {return;}

  let awaitingKeyboard = false;

  const scrollIntoView = () => {
    if (document.activeElement === inputEl) {
      inputEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  inputEl.addEventListener('focus', () => {
    awaitingKeyboard = true;
  });

  inputEl.addEventListener('blur', () => {
    awaitingKeyboard = false;
  });

  window.visualViewport.addEventListener('resize', () => {
    if (awaitingKeyboard) {
      awaitingKeyboard = false;
      // Let the keyboard-show reflow settle a frame before measuring/scrolling.
      requestAnimationFrame(scrollIntoView);
    }
  });
}
