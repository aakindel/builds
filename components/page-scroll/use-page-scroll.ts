"use client";

import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE,
  PAGE_SCROLL_THUMB_REVEAL_DELAY_MS,
  PAGE_SCROLL_TRACKING_ATTRIBUTE,
} from "./page-scroll";
import { getPageScrollRuntime } from "./page-scroll-runtime";

const SCROLL_KEYS = [
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

export function usePageScroll<T extends HTMLElement>() {
  const pathname = usePathname();
  const scrollRef = useRef<T>(null);
  const [entryEpoch, setEntryEpoch] = useState(0);

  useEffect(() => {
    const runtime = getPageScrollRuntime();

    let active = true;

    // Next handles history traversal as a transition. Keep this update at the
    // same priority so it does not restore against the outgoing page.
    function bumpEntryEpoch() {
      startTransition(() => {
        setEntryEpoch((current) => current + 1);
      });
    }

    const unsubscribe = runtime.subscribe((event) => {
      if (event.type === "pop") {
        bumpEntryEpoch();
        return;
      }

      if (
        event.type === "push" ||
        (event.type === "replace" && event.urlChanged)
      ) {
        // Next calls pushState/replaceState from a useInsertionEffect, where
        // React forbids scheduling updates. Wait for that commit to finish.
        queueMicrotask(() => {
          if (active) {
            bumpEntryEpoch();
          }
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const runtime = getPageScrollRuntime();
    runtime.attachContainer(element);
    runtime.notifyContentCommitted(pathname);

    return () => {
      runtime.detachContainer(element);
    };
  }, [pathname, entryEpoch]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const container: T = scrollRef.current;

    const runtime = getPageScrollRuntime();
    let thumbRevealTimer: ReturnType<typeof setTimeout> | null = null;

    function revealScrollbarThumb() {
      container.removeAttribute(PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE);

      if (thumbRevealTimer) {
        clearTimeout(thumbRevealTimer);
        thumbRevealTimer = null;
      }
    }

    container.setAttribute(PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE, "");
    thumbRevealTimer = setTimeout(
      revealScrollbarThumb,
      PAGE_SCROLL_THUMB_REVEAL_DELAY_MS
    );
    container.setAttribute(PAGE_SCROLL_TRACKING_ATTRIBUTE, "");

    function handleUserInput() {
      revealScrollbarThumb();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (SCROLL_KEYS.indexOf(event.key) === -1) {
        return;
      }

      revealScrollbarThumb();
    }

    function handleScroll() {
      runtime.persistFromContainer(false);
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleUserInput, { passive: true });
    container.addEventListener("touchstart", handleUserInput, {
      passive: true,
    });
    container.addEventListener("pointerdown", handleUserInput, {
      passive: true,
    });
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeAttribute(PAGE_SCROLL_TRACKING_ATTRIBUTE);
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleUserInput);
      container.removeEventListener("touchstart", handleUserInput);
      container.removeEventListener("pointerdown", handleUserInput);
      container.removeEventListener("keydown", handleKeyDown);
      if (thumbRevealTimer) {
        clearTimeout(thumbRevealTimer);
      }
    };
  }, [pathname, entryEpoch]);

  return scrollRef;
}
