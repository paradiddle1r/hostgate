"use client";

// Landing-page motion orchestrator (GSAP + ScrollTrigger). Renders nothing —
// it decorates elements by data-attribute so sections stay server-rendered:
//
//   data-fx="parallax" [data-fx-speed="0.12"] — element drifts against scroll
//     (speed = fraction of viewport height it travels over its visibility).
//   data-tilt — 3D perspective tilt that follows the cursor (device mocks).
//   data-magnetic — element is pulled a few px toward the cursor, springs back.
//
// Everything is skipped under prefers-reduced-motion; tilt/magnetic also
// require a fine pointer. All triggers/listeners clean up on unmount.

import { useEffect } from "react";

export default function ScrollFX() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let cleanup = () => {};

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapMod, stMod]) => {
      if (disposed) return;
      const gsap = gsapMod.gsap ?? gsapMod.default;
      const ScrollTrigger = stMod.ScrollTrigger ?? stMod.default;
      gsap.registerPlugin(ScrollTrigger);

      const teardowns: (() => void)[] = [];
      const fine = window.matchMedia("(pointer: fine)").matches;

      // ── scroll parallax ────────────────────────────────────────────────
      document.querySelectorAll<HTMLElement>('[data-fx="parallax"]').forEach((el) => {
        const speed = parseFloat(el.dataset.fxSpeed || "0.1");
        const tween = gsap.fromTo(
          el,
          { y: () => speed * 220 },
          {
            y: () => -speed * 220,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
          },
        );
        teardowns.push(() => { tween.scrollTrigger?.kill(); tween.kill(); });
      });

      // ── cursor 3D tilt ────────────────────────────────────────────────
      if (fine) {
        document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
          const parent = el.parentElement;
          if (parent) parent.style.perspective = "1200px";
          el.style.transformStyle = "preserve-3d";
          el.style.willChange = "transform";
          const setRX = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power2.out" });
          const setRY = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power2.out" });
          const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;   // −0.5 … 0.5
            const py = (e.clientY - r.top) / r.height - 0.5;
            setRX(-py * 7);
            setRY(px * 9);
          };
          const onLeave = () => { setRX(0); setRY(0); };
          el.addEventListener("pointermove", onMove, { passive: true });
          el.addEventListener("pointerleave", onLeave);
          teardowns.push(() => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
            gsap.set(el, { rotationX: 0, rotationY: 0 });
          });
        });

        // ── magnetic buttons ─────────────────────────────────────────────
        document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
          const setX = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
          const setY = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
          const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            setX((e.clientX - (r.left + r.width / 2)) * 0.22);
            setY((e.clientY - (r.top + r.height / 2)) * 0.32);
          };
          const onLeave = () => {
            gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.45)", overwrite: true });
          };
          el.addEventListener("pointermove", onMove, { passive: true });
          el.addEventListener("pointerleave", onLeave);
          teardowns.push(() => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
            gsap.set(el, { x: 0, y: 0 });
          });
        });
      }

      cleanup = () => teardowns.forEach((fn) => fn());
    });

    return () => { disposed = true; cleanup(); };
  }, []);

  return null;
}
