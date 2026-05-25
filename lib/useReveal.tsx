"use client";

import { useEffect, useRef, useState } from "react";

/**
 * IntersectionObserver-based reveal hook.
 * Returns a ref + boolean — apply the ref to any element and use the boolean
 * to trigger CSS transition classes.
 *
 * @param threshold how much of the element must be visible (0-1)
 * @param once stop observing after first reveal (default true)
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.15,
  once = true
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return { ref, visible } as const;
}

/**
 * Returns a ref + `active` boolean — true when the element is in (or near) the
 * viewport, false when scrolled away or the tab is hidden.
 *
 * Use this to gate expensive setIntervals / requestAnimationFrame loops in
 * decorative components (animated mockups, counters) so they stop draining
 * battery and GPU when the user isn't looking.
 */
export function usePauseWhenHidden<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "200px"
) {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let inView = true;
    let tabVisible =
      typeof document === "undefined" ? true : !document.hidden;

    const apply = () => setActive(inView && tabVisible);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView = entry.isIntersecting;
        }
        apply();
      },
      { rootMargin }
    );
    observer.observe(el);

    const onVis = () => {
      tabVisible = !document.hidden;
      apply();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [rootMargin]);

  return { ref, active } as const;
}

/**
 * Track normalized scroll progress through a section (0-1).
 * Useful for parallax/scrub animations.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Map from "section enters viewport" to "section leaves top of viewport"
      const total = rect.height + vh;
      const traveled = vh - rect.top;
      const p = Math.max(0, Math.min(1, traveled / total));
      setProgress(p);
      rafId = null;
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress } as const;
}
