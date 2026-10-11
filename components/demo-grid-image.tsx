"use client";

/* eslint-disable @next/next/no-img-element -- Raw originals preserve the thumbnail's immediate CSS theme switching. */
import React, { useEffect, useRef, useState } from "react";
import { ConditionalRender } from "@/components/conditional-render";
import { PAGE_SCROLL_CONTAINER_ATTRIBUTE } from "@/components/page-scroll/page-scroll";

const THUMBNAIL_WIDTH = 1200;

export const DemoGridImage = ({
  screenshotPath,
  children,
}: {
  screenshotPath: string;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [enhance, setEnhance] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const element = container;
    let nearby = false;
    let resolution: MediaQueryList;

    function update() {
      const width = element.getBoundingClientRect().width;
      const density = window.devicePixelRatio;
      const scale = window.visualViewport?.scale ?? 1;
      setEnhance(nearby && width * density * scale > THUMBNAIL_WIDTH);
    }

    // Re-arm when zoom or moving between displays changes pixel density.
    function watchResolution() {
      resolution?.removeEventListener("change", watchResolution);
      resolution = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`
      );
      resolution.addEventListener("change", watchResolution);
      update();
    }

    const intersection = new IntersectionObserver(
      ([entry]) => {
        nearby = entry.isIntersecting;
        update();
      },
      {
        root: container.closest(`[${PAGE_SCROLL_CONTAINER_ATTRIBUTE}]`),
        rootMargin: "400px 0px",
      }
    );
    const resize = new ResizeObserver(update);
    intersection.observe(container);
    resize.observe(container);
    watchResolution();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      intersection.disconnect();
      resize.disconnect();
      resolution.removeEventListener("change", watchResolution);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {children}
      <ConditionalRender condition={enhance}>
        <DemoGridOriginals
          key={screenshotPath}
          screenshotPath={screenshotPath}
        />
      </ConditionalRender>
    </div>
  );
};

const DemoGridOriginals = ({ screenshotPath }: { screenshotPath: string }) => {
  const lightRef = useRef<HTMLImageElement>(null);
  const darkRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const light = lightRef.current;
    const dark = darkRef.current;
    if (!light || !dark) return;
    const images = [light, dark];

    async function revealWhenDecoded() {
      try {
        await Promise.all(images.map((image) => image.decode()));
        if (active) setReady(true);
      } catch {
        // Failed enhancements leave the working thumbnails visible.
      }
    }
    void revealWhenDecoded();
    return () => {
      active = false;
    };
  }, []);

  return (
    <React.Fragment>
      <img
        ref={lightRef}
        src={`${screenshotPath}-light.webp`}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        style={{ opacity: ready ? 1 : 0 }}
        className="pointer-events-none absolute inset-0 size-full object-cover object-top dark:hidden"
      />
      <img
        ref={darkRef}
        src={`${screenshotPath}-dark.webp`}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        style={{ opacity: ready ? 1 : 0 }}
        className="pointer-events-none absolute inset-0 hidden size-full object-cover object-top dark:block"
      />
    </React.Fragment>
  );
};
