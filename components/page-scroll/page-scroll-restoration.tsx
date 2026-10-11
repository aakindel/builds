import React from "react";
import {
  PAGE_SCROLL_CONTAINER_ATTRIBUTE,
  PAGE_SCROLL_PENDING_ATTRIBUTE,
  PAGE_SCROLL_REVEAL_ANIMATION_NAME,
  PAGE_SCROLL_REVEAL_ATTRIBUTE,
  PAGE_SCROLL_REVEAL_DURATION_MS,
  PAGE_SCROLL_RUNTIME_CONFIG,
  PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE,
} from "./page-scroll";
import { installPageScrollHistory } from "./page-scroll-history";
import { installPageScrollRuntime } from "./page-scroll-runtime";

const PAGE_SCROLL_STYLES = `
html[${PAGE_SCROLL_PENDING_ATTRIBUTE}] [${PAGE_SCROLL_CONTAINER_ATTRIBUTE}] {
  visibility: hidden;
}

/* Reached only when the rule above hid the container, so a reload at the top of
   the page — which never sets the pending attribute — still paints instantly. */
html[${PAGE_SCROLL_REVEAL_ATTRIBUTE}] [${PAGE_SCROLL_CONTAINER_ATTRIBUTE}] {
  animation: ${PAGE_SCROLL_REVEAL_ANIMATION_NAME} ${PAGE_SCROLL_REVEAL_DURATION_MS}ms ease-out both;
}

@keyframes ${PAGE_SCROLL_REVEAL_ANIMATION_NAME} {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  html[${PAGE_SCROLL_REVEAL_ATTRIBUTE}] [${PAGE_SCROLL_CONTAINER_ATTRIBUTE}] {
    animation: none;
  }
}

[${PAGE_SCROLL_CONTAINER_ATTRIBUTE}][${PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE}] {
  scrollbar-color: transparent transparent;
}

[${PAGE_SCROLL_CONTAINER_ATTRIBUTE}][${PAGE_SCROLL_THUMB_HIDDEN_ATTRIBUTE}]::-webkit-scrollbar-thumb {
  background-color: transparent;
}
`;

export const createPageScrollRestorationScript = () => `
(function () {
  var config = ${JSON.stringify(PAGE_SCROLL_RUNTIME_CONFIG)};
  var installHistory = ${String(installPageScrollHistory)};
  var installRuntime = ${String(installPageScrollRuntime)};
  installHistory(config);
  var runtime = installRuntime(config);
  if (runtime && runtime.bootstrapDocument) {
    runtime.bootstrapDocument();
  }
})();
`;

export const PageScrollRestoration = () => {
  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{ __html: PAGE_SCROLL_STYLES }} />
      {/* Only the server-rendered copy runs. On client navigation React mounts a
          fresh tag that never executes, and usePageScroll installs the runtime
          lazily instead, so mark that copy inert to skip React's script warning. */}
      <script
        type={typeof window === "undefined" ? undefined : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: createPageScrollRestorationScript(),
        }}
      />
    </React.Fragment>
  );
};
