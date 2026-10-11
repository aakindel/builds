export type PageScrollHistoryConfig = {
  runtimeProperty: string;
  stateKey: string;
  entryIdKey: string;
  persistDebounceMs: number;
};

export type PageScrollHistoryEventType = "push" | "replace" | "pop";

export type PageScrollHistoryEvent = {
  type: PageScrollHistoryEventType;
  entryId: string;
  url: string;
  urlChanged: boolean;
  scrollTop: number | null;
};

export type PageScrollHistoryListener = (event: PageScrollHistoryEvent) => void;

export type PageScrollHistoryAdapter = {
  getCurrentEntryId: () => string;
  getLatestPosition: (entryId: string) => number | null;
  updateLatestPosition: (entryId: string, scrollTop: number) => void;
  writeIfOwned: (entryId: string, scrollTop: number) => boolean;
  persist: (scrollTop: number, immediate: boolean) => void;
  flush: () => void;
  subscribe: (listener: PageScrollHistoryListener) => () => void;
  readScrollTopFromState: (state: unknown) => number | null;
};

type HistoryRoot = {
  history?: PageScrollHistoryAdapter;
};

/**
 * Installed once by the blocking bootstrap. Serialized with `String()` into
 * that script, so the body must stay self-contained: no imports, no module
 * identifiers, and no syntax a bundler would rewrite (object spread,
 * optional chaining, `for...of`, async/await).
 */
export function installPageScrollHistory(
  config: PageScrollHistoryConfig
): PageScrollHistoryAdapter {
  const runtimeProperty = config.runtimeProperty;
  const stateKey = config.stateKey;
  const entryIdKey = config.entryIdKey;
  const persistDebounceMs = config.persistDebounceMs;
  const store = window as unknown as Record<string, HistoryRoot | undefined>;
  let root = store[runtimeProperty];

  if (!root) {
    root = {};
    store[runtimeProperty] = root;
  }

  if (root.history) {
    return root.history;
  }

  const latestPositions: Record<string, number> = {};
  let listeners: PageScrollHistoryListener[] = [];
  let isInternalWrite = false;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let persistEntryId: string | null = null;
  let persistValue: number | null = null;
  let currentEntryId = "";

  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function parseScrollTop(value: unknown): number | null {
    if (typeof value !== "number" || !isFinite(value) || value < 0) {
      return null;
    }

    return value;
  }

  function cloneRecord(value: unknown): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    if (!isRecord(value)) {
      return next;
    }

    const keys = Object.keys(value);
    for (let index = 0; index < keys.length; index++) {
      next[keys[index]] = value[keys[index]];
    }

    return next;
  }

  function normalizeScrollTop(scrollTop: number): number {
    return Math.max(0, Math.round(scrollTop));
  }

  function createEntryId(): string {
    return (
      "ps-" +
      Math.random().toString(36).slice(2, 10) +
      "-" +
      Date.now().toString(36)
    );
  }

  function resolveHref(url: string | URL | null | undefined): string {
    if (url == null || url === "") {
      return location.href;
    }

    try {
      return new URL(String(url), location.href).href;
    } catch {
      return location.href;
    }
  }

  function readScrollTopFromState(state: unknown): number | null {
    if (!isRecord(state)) {
      return null;
    }

    return parseScrollTop(state[stateKey]);
  }

  function publish(event: PageScrollHistoryEvent): void {
    const snapshot = listeners.slice();
    for (let index = 0; index < snapshot.length; index++) {
      snapshot[index](event);
    }
  }

  function writeIfOwned(entryId: string, scrollTop: number): boolean {
    if (entryId !== currentEntryId) {
      return false;
    }

    const next = cloneRecord(history.state);
    next[entryIdKey] = entryId;
    next[stateKey] = normalizeScrollTop(scrollTop);
    isInternalWrite = true;
    try {
      originalReplace(next, "");
    } finally {
      isInternalWrite = false;
    }

    return true;
  }

  function updateLatestPosition(entryId: string, scrollTop: number): void {
    latestPositions[entryId] = normalizeScrollTop(scrollTop);
  }

  function getLatestPosition(entryId: string): number | null {
    if (!Object.prototype.hasOwnProperty.call(latestPositions, entryId)) {
      return null;
    }

    return latestPositions[entryId];
  }

  function persist(scrollTop: number, immediate: boolean): void {
    const entryId = currentEntryId;
    const rounded = normalizeScrollTop(scrollTop);
    latestPositions[entryId] = rounded;

    if (immediate) {
      if (persistTimer !== null) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }

      persistEntryId = null;
      persistValue = null;
      writeIfOwned(entryId, rounded);
      return;
    }

    persistEntryId = entryId;
    persistValue = rounded;

    if (persistTimer !== null) {
      clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(function () {
      persistTimer = null;
      const queuedEntryId = persistEntryId;
      const queuedValue = persistValue;
      persistEntryId = null;
      persistValue = null;
      if (queuedEntryId !== null && queuedValue !== null) {
        writeIfOwned(queuedEntryId, queuedValue);
      }
    }, persistDebounceMs);
  }

  function flush(): void {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    const entryId = persistEntryId !== null ? persistEntryId : currentEntryId;
    const value =
      persistValue !== null
        ? persistValue
        : Object.prototype.hasOwnProperty.call(latestPositions, currentEntryId)
          ? latestPositions[currentEntryId]
          : null;

    persistEntryId = null;
    persistValue = null;

    if (value !== null) {
      latestPositions[entryId] = value;
      writeIfOwned(entryId, value);
    }
  }

  function subscribe(listener: PageScrollHistoryListener): () => void {
    listeners.push(listener);
    return function () {
      const next: PageScrollHistoryListener[] = [];
      for (let index = 0; index < listeners.length; index++) {
        if (listeners[index] !== listener) {
          next.push(listeners[index]);
        }
      }
      listeners = next;
    };
  }

  function ensureCurrentEntry(): void {
    const currentState = cloneRecord(history.state);
    const existingId = currentState[entryIdKey];
    if (typeof existingId === "string" && existingId) {
      currentEntryId = existingId;
    } else {
      currentEntryId = createEntryId();
      currentState[entryIdKey] = currentEntryId;
      isInternalWrite = true;
      try {
        originalReplace(currentState, "");
      } finally {
        isInternalWrite = false;
      }
    }

    let existingScroll = parseScrollTop(currentState[stateKey]);
    if (existingScroll === null) {
      existingScroll = parseScrollTop(cloneRecord(history.state)[stateKey]);
    }

    if (existingScroll !== null) {
      latestPositions[currentEntryId] = normalizeScrollTop(existingScroll);
    }
  }

  history.pushState = function patchedPushState(
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    if (isInternalWrite) {
      return originalPush(data, unused, url);
    }

    flush();

    const next = cloneRecord(data);
    const newId = createEntryId();
    next[entryIdKey] = newId;
    delete next[stateKey];

    const result = originalPush(next, unused, url);
    currentEntryId = newId;
    publish({
      type: "push",
      entryId: newId,
      url: location.href,
      urlChanged: true,
      scrollTop: null,
    });
    return result;
  };

  history.replaceState = function patchedReplaceState(
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    if (isInternalWrite) {
      return originalReplace(data, unused, url);
    }

    const nextHref = resolveHref(url);
    const urlChanged = url != null && url !== "" && nextHref !== location.href;
    const next = cloneRecord(data);

    if (urlChanged) {
      flush();
      const newId = createEntryId();
      next[entryIdKey] = newId;
      delete next[stateKey];
      const replaced = originalReplace(next, unused, url);
      currentEntryId = newId;
      publish({
        type: "replace",
        entryId: newId,
        url: location.href,
        urlChanged: true,
        scrollTop: null,
      });
      return replaced;
    }

    next[entryIdKey] = currentEntryId;
    const incomingScroll = parseScrollTop(next[stateKey]);
    const existingScroll = parseScrollTop(cloneRecord(history.state)[stateKey]);
    const latest = Object.prototype.hasOwnProperty.call(
      latestPositions,
      currentEntryId
    )
      ? latestPositions[currentEntryId]
      : existingScroll;

    if (incomingScroll === null && latest != null) {
      next[stateKey] = normalizeScrollTop(latest);
    } else if (incomingScroll !== null) {
      latestPositions[currentEntryId] = normalizeScrollTop(incomingScroll);
    }

    return originalReplace(next, unused, url);
  };

  window.addEventListener("popstate", function (event) {
    const state = cloneRecord(event.state);
    let entryId =
      typeof state[entryIdKey] === "string" && state[entryIdKey]
        ? String(state[entryIdKey])
        : "";
    const scroll = parseScrollTop(state[stateKey]);

    if (!entryId) {
      entryId = createEntryId();
      state[entryIdKey] = entryId;
      if (scroll !== null) {
        state[stateKey] = scroll;
      }

      isInternalWrite = true;
      try {
        originalReplace(state, "");
      } finally {
        isInternalWrite = false;
      }
    }

    currentEntryId = entryId;
    const latest = Object.prototype.hasOwnProperty.call(
      latestPositions,
      entryId
    )
      ? latestPositions[entryId]
      : scroll;

    publish({
      type: "pop",
      entryId: entryId,
      url: location.href,
      urlChanged: true,
      scrollTop: latest,
    });
  });

  ensureCurrentEntry();

  const adapter: PageScrollHistoryAdapter = {
    getCurrentEntryId: function () {
      return currentEntryId;
    },
    getLatestPosition: getLatestPosition,
    updateLatestPosition: updateLatestPosition,
    writeIfOwned: writeIfOwned,
    persist: persist,
    flush: flush,
    subscribe: subscribe,
    readScrollTopFromState: readScrollTopFromState,
  };

  root.history = adapter;
  return adapter;
}
