export const PAGE_SCROLL_STATE_KEY = "__pageScrollTop";

export const PAGE_SCROLL_ENTRY_ID_KEY = "__pageScrollEntryId";

export const PAGE_SCROLL_CONTAINER_ATTRIBUTE = "data-page-scroll-container";

export const PAGE_SCROLL_PENDING_ATTRIBUTE = "data-page-scroll-pending";

// Set only while a hidden container is being revealed, so a reload that never
// hid anything still paints instantly.
export const PAGE_SCROLL_REVEAL_ATTRIBUTE = "data-page-scroll-reveal";

export const PAGE_SCROLL_REVEAL_ANIMATION_NAME = "page-scroll-reveal";

// Keep in sync with the reveal animation in page-scroll-restoration.tsx.
export const PAGE_SCROLL_REVEAL_DURATION_MS = 250;

// Starts after the animation is requested, so it outlives a late first frame.
export const PAGE_SCROLL_REVEAL_CLEANUP_MS = 500;

export const PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE =
  "data-page-scroll-thumb-hidden";

export const PAGE_SCROLL_THUMB_REVEAL_DELAY_MS = 3000;

// Signals that persistence listeners are attached — E2E waits for this after hydration.
export const PAGE_SCROLL_TRACKING_ATTRIBUTE = "data-page-scroll-tracking";

export const PAGE_SCROLL_RESTORE_TIMEOUT_MS = 2000;

export const PAGE_SCROLL_RESTORE_TOLERANCE_PX = 1;

export const PAGE_SCROLL_PERSIST_DEBOUNCE_MS = 300;

export const PAGE_SCROLL_RUNTIME_PROPERTY = "__qdPageScrollRuntime";

export const PAGE_SCROLL_RUNTIME_CONFIG = {
  runtimeProperty: PAGE_SCROLL_RUNTIME_PROPERTY,
  stateKey: PAGE_SCROLL_STATE_KEY,
  entryIdKey: PAGE_SCROLL_ENTRY_ID_KEY,
  containerAttribute: PAGE_SCROLL_CONTAINER_ATTRIBUTE,
  pendingAttribute: PAGE_SCROLL_PENDING_ATTRIBUTE,
  revealAttribute: PAGE_SCROLL_REVEAL_ATTRIBUTE,
  restoreTimeoutMs: PAGE_SCROLL_RESTORE_TIMEOUT_MS,
  tolerancePx: PAGE_SCROLL_RESTORE_TOLERANCE_PX,
  revealCleanupMs: PAGE_SCROLL_REVEAL_CLEANUP_MS,
  persistDebounceMs: PAGE_SCROLL_PERSIST_DEBOUNCE_MS,
  revealAnimationName: PAGE_SCROLL_REVEAL_ANIMATION_NAME,
};
