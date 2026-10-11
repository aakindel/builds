import { PAGE_SCROLL_RUNTIME_CONFIG } from "./page-scroll";
import {
  installPageScrollHistory,
  type PageScrollHistoryAdapter,
  type PageScrollHistoryEvent,
} from "./page-scroll-history";

export type PageScrollRuntimeConfig = {
  runtimeProperty: string;
  containerAttribute: string;
  pendingAttribute: string;
  revealAttribute: string;
  restoreTimeoutMs: number;
  tolerancePx: number;
  revealCleanupMs: number;
  revealAnimationName: string;
};

export type PageScrollAttemptPhase =
  "waiting-for-container" | "restoring" | "finished";

export type PageScrollCompletionReason =
  | "restored"
  | "expired"
  | "cancelled"
  | "navigated"
  | "container-disposed"
  | "pagehide";

export type PageScrollAttempt = {
  id: string;
  entryId: string;
  targetScrollTop: number;
  deadline: number;
  concealEligible: boolean;
  appliedPending: boolean;
  fadeEligible: boolean;
  container: HTMLElement | null;
  phase: PageScrollAttemptPhase;
  completionReason: PageScrollCompletionReason | null;
};

export type PageScrollRuntimeEvent = PageScrollHistoryEvent;

export type PageScrollRuntime = {
  history: PageScrollHistoryAdapter;
  bootstrapDocument: () => void;
  startRestoration: (spec: {
    entryId: string;
    targetScrollTop: number;
    deadline: number;
    concealEligible: boolean;
  }) => PageScrollAttempt;
  attachContainer: (element: HTMLElement) => void;
  detachContainer: (element: HTMLElement) => void;
  notifyContentCommitted: (committedPathname?: string) => void;
  persistFromContainer: (immediate: boolean) => void;
  handlePageHide: (event: PageTransitionEvent) => void;
  handlePageShow: (event: PageTransitionEvent) => void;
  subscribe: (listener: (event: PageScrollRuntimeEvent) => void) => () => void;
  getCurrentAttempt: () => PageScrollAttempt | null;
  isTracking: () => boolean;
};

type RuntimeRoot = {
  history?: PageScrollHistoryAdapter;
  runtime?: PageScrollRuntime;
  didBootstrapDocument?: boolean;
};

/**
 * Document-scoped restoration owner. Serialized with `String()` into the
 * blocking bootstrap, so the body must stay self-contained: no imports, no
 * module identifiers, and no syntax a bundler would rewrite (object spread,
 * optional chaining, `for...of`, async/await).
 */
export function installPageScrollRuntime(
  config: PageScrollRuntimeConfig
): PageScrollRuntime {
  const runtimeProperty = config.runtimeProperty;
  const containerAttribute = config.containerAttribute;
  const pendingAttribute = config.pendingAttribute;
  const revealAttribute = config.revealAttribute;
  const restoreTimeoutMs = config.restoreTimeoutMs;
  const tolerancePx = config.tolerancePx;
  const revealCleanupMs = config.revealCleanupMs;
  const revealAnimationName = config.revealAnimationName;
  const documentElement = document.documentElement;
  const containerSelector = "[" + containerAttribute + "]";
  const store = window as unknown as Record<string, RuntimeRoot | undefined>;
  let root = store[runtimeProperty];

  if (!root) {
    root = {};
    store[runtimeProperty] = root;
  }

  const runtimeRoot = root;

  if (runtimeRoot.runtime) {
    return runtimeRoot.runtime;
  }

  const installedHistory = runtimeRoot.history;
  if (!installedHistory) {
    throw new Error("page-scroll history must be installed first");
  }

  const historyAdapter = installedHistory;

  let currentAttempt: PageScrollAttempt | null = null;
  let attachedContainer: HTMLElement | null = null;
  let detachTimer: ReturnType<typeof setTimeout> | null = null;
  let frameId: number | null = null;
  let eligibilityFrameId: number | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let documentObserver: MutationObserver | null = null;
  let contentObserver: MutationObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let observedChildren: Element[] = [];
  let userListenersAttached = false;
  let isTracking = false;
  let pendingClientRestore: {
    entryId: string;
    targetScrollTop: number | null;
    pathname: string;
  } | null = null;
  let revealAttemptId: string | null = null;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let revealListener: {
    container: HTMLElement;
    onEnd: (event: AnimationEvent) => void;
  } | null = null;

  const scrollKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
    "Spacebar",
  ];

  function createAttemptId(): string {
    return (
      "att-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(36)
    );
  }

  function prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function isCurrent(attempt: PageScrollAttempt): boolean {
    return currentAttempt === attempt && attempt.phase !== "finished";
  }

  function findContainer(): HTMLElement | null {
    if (attachedContainer) {
      return attachedContainer;
    }

    return document.querySelector(containerSelector);
  }

  function getMaxScrollTop(element: HTMLElement): number {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function applyScrollTop(element: HTMLElement, scrollTop: number): void {
    const previous = element.style.scrollBehavior;
    element.style.scrollBehavior = "auto";
    element.scrollTop = scrollTop;
    if (previous) {
      element.style.scrollBehavior = previous;
    } else {
      element.style.removeProperty("scroll-behavior");
    }
  }

  function isImmediatelyReachable(targetScrollTop: number): boolean {
    const container = findContainer();
    if (!container) {
      return false;
    }

    return getMaxScrollTop(container) + tolerancePx >= targetScrollTop;
  }

  function removePendingIfOwned(attempt: PageScrollAttempt): void {
    if (!attempt.appliedPending) {
      return;
    }

    if (documentElement.getAttribute(pendingAttribute) !== null) {
      documentElement.removeAttribute(pendingAttribute);
    }
  }

  function clearReveal(attemptId: string | null): void {
    if (attemptId !== null && revealAttemptId !== attemptId) {
      return;
    }

    if (revealListener) {
      revealListener.container.removeEventListener(
        "animationend",
        revealListener.onEnd
      );
      revealListener = null;
    }

    if (revealTimer !== null) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }

    if (revealAttemptId !== null && revealAttemptId === attemptId) {
      documentElement.removeAttribute(revealAttribute);
      revealAttemptId = null;
      return;
    }

    if (attemptId === null) {
      documentElement.removeAttribute(revealAttribute);
      revealAttemptId = null;
    }
  }

  function releaseOwnedVisual(attempt: PageScrollAttempt): void {
    removePendingIfOwned(attempt);
    clearReveal(attempt.id);
  }

  function revealAttempt(attempt: PageScrollAttempt): void {
    if (!attempt.appliedPending) {
      removePendingIfOwned(attempt);
      return;
    }

    removePendingIfOwned(attempt);

    if (!attempt.fadeEligible || !attempt.container || prefersReducedMotion()) {
      return;
    }

    documentElement.setAttribute(revealAttribute, "");
    revealAttemptId = attempt.id;

    const container = attempt.container;
    if (container) {
      const onEnd = function (event: AnimationEvent) {
        if (revealAttemptId !== attempt.id) {
          return;
        }

        if (event.target !== container) {
          return;
        }

        if (event.animationName !== revealAnimationName) {
          return;
        }

        clearReveal(attempt.id);
      };

      container.addEventListener("animationend", onEnd);
      revealListener = {
        container: container,
        onEnd: onEnd,
      };
    }

    revealTimer = setTimeout(function () {
      clearReveal(attempt.id);
    }, revealCleanupMs);
  }

  function disconnectObservers(): void {
    if (documentObserver) {
      documentObserver.disconnect();
      documentObserver = null;
    }

    if (contentObserver) {
      contentObserver.disconnect();
      contentObserver = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    observedChildren = [];
  }

  function detachUserListeners(): void {
    if (!userListenersAttached) {
      return;
    }

    document.removeEventListener("wheel", handleWheel);
    document.removeEventListener("touchstart", handleTouchStart);
    document.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("keydown", handleKeyDown);
    userListenersAttached = false;
  }

  function cancelQueuedFrame(): void {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function clearDeadlineTimer(): void {
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
  }

  function teardownAttemptResources(): void {
    cancelQueuedFrame();
    if (eligibilityFrameId !== null) {
      cancelAnimationFrame(eligibilityFrameId);
      eligibilityFrameId = null;
    }
    clearDeadlineTimer();
    disconnectObservers();
    detachUserListeners();
  }

  function syncObservedChildren(container: HTMLElement): void {
    if (!resizeObserver) {
      return;
    }

    const children = container.children;
    const next: Element[] = [];
    for (let index = 0; index < children.length; index++) {
      next.push(children[index]);
    }

    for (let stale = 0; stale < observedChildren.length; stale++) {
      const staleChild = observedChildren[stale];
      if (next.indexOf(staleChild) === -1) {
        resizeObserver.unobserve(staleChild);
      }
    }

    for (let added = 0; added < next.length; added++) {
      if (observedChildren.indexOf(next[added]) === -1) {
        resizeObserver.observe(next[added]);
      }
    }

    observedChildren = next;
  }

  function bindContainerObservers(container: HTMLElement): void {
    if (documentObserver) {
      documentObserver.disconnect();
      documentObserver = null;
    }

    if (!contentObserver) {
      contentObserver = new MutationObserver(function () {
        scheduleCheck();
      });
      contentObserver.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(function () {
        scheduleCheck();
      });
      resizeObserver.observe(container);
    }

    syncObservedChildren(container);
  }

  function bindAttemptResources(attempt: PageScrollAttempt): void {
    if (!documentObserver && !findContainer()) {
      documentObserver = new MutationObserver(function () {
        scheduleCheck();
      });
      documentObserver.observe(documentElement, {
        childList: true,
        subtree: true,
      });
    }

    const container = findContainer();
    if (container) {
      attempt.container = container;
      bindContainerObservers(container);
    }

    if (!userListenersAttached) {
      document.addEventListener("wheel", handleWheel, { passive: true });
      document.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      document.addEventListener("pointerdown", handlePointerDown, {
        passive: true,
      });
      document.addEventListener("keydown", handleKeyDown);
      userListenersAttached = true;
    }

    clearDeadlineTimer();
    deadlineTimer = setTimeout(
      function () {
        expireAttempt(attempt);
      },
      Math.max(0, attempt.deadline - performance.now())
    );
  }

  function scheduleCheck(): void {
    if (!currentAttempt || currentAttempt.phase === "finished") {
      return;
    }

    if (frameId !== null) {
      return;
    }

    frameId = requestAnimationFrame(function () {
      frameId = null;
      if (currentAttempt) {
        checkAttempt(currentAttempt);
      }
    });
  }

  function concealAttempt(attempt: PageScrollAttempt): void {
    documentElement.setAttribute(
      pendingAttribute,
      String(attempt.targetScrollTop)
    );
    attempt.appliedPending = true;
    // The first callback is before repaint. Restore there without a fade if
    // possible; only a still-pending attempt reaching the next frame qualifies.
    // This tracks rendering opportunities, not proof of a displayed paint.
    eligibilityFrameId = requestAnimationFrame(() => {
      eligibilityFrameId = null;
      if (!isCurrent(attempt)) return;
      checkAttempt(attempt);
      if (!isCurrent(attempt)) return;
      eligibilityFrameId = requestAnimationFrame(() => {
        eligibilityFrameId = null;
        if (!isCurrent(attempt)) return;
        attempt.fadeEligible = true;
        checkAttempt(attempt);
      });
    });
  }

  function checkAttempt(attempt: PageScrollAttempt): void {
    if (!isCurrent(attempt)) {
      return;
    }

    const container = attempt.container || findContainer();
    if (!container) {
      return;
    }

    attempt.container = container;
    bindContainerObservers(container);

    if (attempt.phase === "waiting-for-container") {
      attempt.phase = "restoring";
    }

    const maxScrollTop = getMaxScrollTop(container);
    if (maxScrollTop + tolerancePx < attempt.targetScrollTop) {
      if (attempt.concealEligible && !attempt.appliedPending) {
        concealAttempt(attempt);
      }
      return;
    }

    applyScrollTop(container, attempt.targetScrollTop);
    if (
      Math.abs(container.scrollTop - attempt.targetScrollTop) <= tolerancePx
    ) {
      completeAttempt(attempt, "restored");
    }
  }

  function expireAttempt(attempt: PageScrollAttempt): void {
    deadlineTimer = null;
    if (!isCurrent(attempt)) {
      return;
    }

    const container = attempt.container || findContainer();
    if (container) {
      attempt.container = container;
      applyScrollTop(
        container,
        Math.min(attempt.targetScrollTop, getMaxScrollTop(container))
      );
    }

    completeAttempt(attempt, "expired");
  }

  function completeAttempt(
    attempt: PageScrollAttempt,
    reason: PageScrollCompletionReason
  ): void {
    if (attempt.phase === "finished") {
      return;
    }

    if (currentAttempt !== attempt) {
      return;
    }

    attempt.phase = "finished";
    attempt.completionReason = reason;
    teardownAttemptResources();

    if (reason === "restored" || reason === "expired") {
      if (attempt.container) {
        historyAdapter.updateLatestPosition(
          attempt.entryId,
          attempt.container.scrollTop
        );
        historyAdapter.writeIfOwned(
          attempt.entryId,
          attempt.container.scrollTop
        );
      }
      isTracking = true;
      revealAttempt(attempt);
      return;
    }

    if (reason === "cancelled") {
      isTracking = true;
      releaseOwnedVisual(attempt);
      return;
    }

    if (reason === "pagehide") {
      isTracking = false;
      releaseOwnedVisual(attempt);
      return;
    }

    isTracking = false;
    releaseOwnedVisual(attempt);
  }

  function startRestoration(spec: {
    entryId: string;
    targetScrollTop: number;
    deadline: number;
    concealEligible: boolean;
  }): PageScrollAttempt {
    if (currentAttempt && currentAttempt.phase !== "finished") {
      completeAttempt(currentAttempt, "navigated");
    }

    clearReveal(revealAttemptId);

    const attempt: PageScrollAttempt = {
      id: createAttemptId(),
      entryId: spec.entryId,
      targetScrollTop: spec.targetScrollTop,
      deadline: spec.deadline,
      concealEligible: spec.concealEligible,
      appliedPending: false,
      fadeEligible: false,
      container: attachedContainer,
      phase: "waiting-for-container",
      completionReason: null,
    };

    currentAttempt = attempt;
    isTracking = false;

    if (
      attempt.concealEligible &&
      !isImmediatelyReachable(attempt.targetScrollTop)
    ) {
      concealAttempt(attempt);
    }

    bindAttemptResources(attempt);
    checkAttempt(attempt);
    return attempt;
  }

  function bootstrapDocument(): void {
    if (runtimeRoot.didBootstrapDocument) {
      return;
    }

    runtimeRoot.didBootstrapDocument = true;

    if (currentAttempt && currentAttempt.phase !== "finished") {
      return;
    }

    const entries = performance.getEntriesByType("navigation");
    const nav = entries.length > 0 ? entries[0] : null;
    const navType = nav && "type" in nav ? String(nav.type) : "";
    if (navType !== "reload" && navType !== "back_forward") {
      isTracking = true;
      return;
    }

    const target = historyAdapter.readScrollTopFromState(history.state);
    if (target === null) {
      isTracking = true;
      return;
    }

    startRestoration({
      entryId: historyAdapter.getCurrentEntryId(),
      targetScrollTop: target,
      deadline: performance.now() + restoreTimeoutMs,
      // Any unresolved nonzero document restore can otherwise paint at the top.
      concealEligible: target > 0,
    });
  }

  function startPendingClientRestore(): void {
    if (!pendingClientRestore) {
      return;
    }

    if (pendingClientRestore.entryId !== historyAdapter.getCurrentEntryId()) {
      return;
    }

    const target = pendingClientRestore.targetScrollTop;
    pendingClientRestore = null;
    if (target === null) {
      isTracking = true;
      return;
    }

    startRestoration({
      entryId: historyAdapter.getCurrentEntryId(),
      targetScrollTop: target,
      deadline: performance.now() + restoreTimeoutMs,
      concealEligible: false,
    });
  }

  /* usePathname() is decoded; URL.pathname is percent-encoded. */
  function normalizePathname(pathname: string): string {
    try {
      return decodeURI(pathname);
    } catch {
      return pathname;
    }
  }

  function notifyContentCommitted(committedPathname?: string): void {
    /* On a cross-route traversal the outgoing page can commit before the
       destination does. Its container would take the restore and leave the
       destination page at the top, so only the destination route may claim a
       pending restore. */
    if (
      pendingClientRestore &&
      committedPathname !== undefined &&
      normalizePathname(committedPathname) !== pendingClientRestore.pathname
    ) {
      return;
    }

    if (currentAttempt && currentAttempt.phase !== "finished") {
      if (attachedContainer) {
        currentAttempt.container = attachedContainer;
        scheduleCheck();
      }
      return;
    }

    startPendingClientRestore();
    if (
      !pendingClientRestore &&
      (!currentAttempt || currentAttempt.phase === "finished")
    ) {
      isTracking = true;
    }
  }

  function attachContainer(element: HTMLElement): void {
    if (detachTimer !== null) {
      clearTimeout(detachTimer);
      detachTimer = null;
    }

    attachedContainer = element;
    if (currentAttempt && currentAttempt.phase !== "finished") {
      currentAttempt.container = element;
      scheduleCheck();
      return;
    }
  }

  function detachContainer(element: HTMLElement): void {
    if (attachedContainer !== element) {
      return;
    }

    if (detachTimer !== null) {
      clearTimeout(detachTimer);
    }

    detachTimer = setTimeout(function () {
      detachTimer = null;
      if (attachedContainer !== element) {
        return;
      }

      attachedContainer = null;
      if (currentAttempt && currentAttempt.phase !== "finished") {
        completeAttempt(currentAttempt, "container-disposed");
      }
    }, 0);
  }

  function persistFromContainer(immediate: boolean): void {
    if (!isTracking || !attachedContainer) {
      return;
    }

    if (currentAttempt && currentAttempt.phase !== "finished") {
      return;
    }

    historyAdapter.persist(attachedContainer.scrollTop, immediate);
  }

  function handlePageHide(): void {
    if (currentAttempt && currentAttempt.phase !== "finished") {
      completeAttempt(currentAttempt, "pagehide");
      return;
    }

    if (isTracking && attachedContainer) {
      historyAdapter.persist(attachedContainer.scrollTop, true);
    }
  }

  function handlePageShow(event: PageTransitionEvent): void {
    if (!event.persisted) {
      return;
    }

    isTracking = true;
  }

  function isInsideContainer(target: EventTarget | null): boolean {
    const container = attachedContainer || findContainer();
    if (!container || !target) {
      return false;
    }

    return target instanceof Node && container.contains(target);
  }

  function isInteractiveKeyTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }

    const tagName = target.tagName;
    if (
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT" ||
      tagName === "OPTION"
    ) {
      return true;
    }

    if ((target as HTMLElement).isContentEditable === true) {
      return true;
    }

    return target.closest('[contenteditable="true"]') !== null;
  }

  function cancelForUser(): void {
    if (!currentAttempt || currentAttempt.phase === "finished") {
      return;
    }

    completeAttempt(currentAttempt, "cancelled");
  }

  function handleWheel(event: WheelEvent): void {
    if (event.deltaY === 0 && event.deltaX === 0) {
      return;
    }

    cancelForUser();
  }

  function handleTouchStart(): void {
    cancelForUser();
  }

  function handlePointerDown(event: PointerEvent): void {
    if (isInsideContainer(event.target)) {
      cancelForUser();
      return;
    }

    const container = attachedContainer || findContainer();
    if (!container) {
      return;
    }

    const verticalGutter = container.offsetWidth - container.clientWidth;
    const horizontalGutter = container.offsetHeight - container.clientHeight;
    if (verticalGutter <= 0 && horizontalGutter <= 0) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      return;
    }

    const contentLeft = rect.left + container.clientLeft;
    const contentTop = rect.top + container.clientTop;
    const contentRight = contentLeft + container.clientWidth;
    const contentBottom = contentTop + container.clientHeight;

    if (verticalGutter > 0 && (x > contentRight || x < contentLeft)) {
      cancelForUser();
      return;
    }

    if (horizontalGutter > 0 && (y > contentBottom || y < contentTop)) {
      cancelForUser();
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (scrollKeys.indexOf(event.key) === -1) {
      return;
    }

    if (isInteractiveKeyTarget(event.target)) {
      return;
    }

    const target = event.target;
    if (
      target !== document.body &&
      target !== documentElement &&
      target !== document &&
      !isInsideContainer(target)
    ) {
      return;
    }

    cancelForUser();
  }

  function subscribe(
    listener: (event: PageScrollRuntimeEvent) => void
  ): () => void {
    return historyAdapter.subscribe(listener);
  }

  function releaseTransientVisual(): void {
    if (currentAttempt && currentAttempt.phase !== "finished") {
      completeAttempt(currentAttempt, "navigated");
      return;
    }

    clearReveal(revealAttemptId);
    documentElement.removeAttribute(pendingAttribute);
  }

  historyAdapter.subscribe(function (event) {
    if (event.type === "pop") {
      isTracking = false;
      pendingClientRestore = {
        entryId: event.entryId,
        targetScrollTop: event.scrollTop,
        pathname: normalizePathname(new URL(event.url, location.href).pathname),
      };
      releaseTransientVisual();
      return;
    }

    if (
      event.type === "push" ||
      (event.type === "replace" && event.urlChanged)
    ) {
      isTracking = false;
      pendingClientRestore = null;
      releaseTransientVisual();
    }
  });

  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);

  const runtime: PageScrollRuntime = {
    history: historyAdapter,
    bootstrapDocument: bootstrapDocument,
    startRestoration: startRestoration,
    attachContainer: attachContainer,
    detachContainer: detachContainer,
    notifyContentCommitted: notifyContentCommitted,
    persistFromContainer: persistFromContainer,
    handlePageHide: handlePageHide,
    handlePageShow: handlePageShow,
    subscribe: subscribe,
    getCurrentAttempt: function () {
      return currentAttempt;
    },
    isTracking: function () {
      return isTracking;
    },
  };

  runtimeRoot.runtime = runtime;
  return runtime;
}

export function getPageScrollRuntime(): PageScrollRuntime {
  installPageScrollHistory(PAGE_SCROLL_RUNTIME_CONFIG);
  return installPageScrollRuntime(PAGE_SCROLL_RUNTIME_CONFIG);
}
