"use client";

// Award-grade living backdrop for the Aurora themes. A full-screen WebGL
// fragment shader (Three.js) paints slow, domain-warped aurora ribbons that
// drift forever and lean toward the cursor; GSAP eases the parallax + fades the
// canvas in. GPU-only (one fullscreen triangle), DPR-capped, pauses on tab blur,
// and degrades to a single static frame under prefers-reduced-motion. Mounted
// only while an Aurora theme is active and loaded via next/dynamic (ssr:false),
// so neither three nor gsap ever touch the server bundle or the other themes.

import { useEffect, useRef } from "react";

type Variant = "light" | "dark";

// Palette per variant: a base wash + four aurora colours (RGB 0–1).
const PALETTES: Record<
  Variant,
  { base: [number, number, number]; colors: [number, number, number][]; intensity: number }
> = {
  dark: {
    base: [0.024, 0.027, 0.06],
    colors: [
      [0.08, 0.88, 0.78], // teal
      [0.30, 0.49, 1.0], // electric blue
      [0.61, 0.36, 1.0], // violet
      [1.0, 0.30, 0.62], // magenta
    ],
    intensity: 1.0,
  },
  light: {
    base: [0.93, 0.95, 0.99],
    colors: [
      [0.49, 0.72, 1.0], // sky
      [0.56, 0.94, 0.84], // mint
      [0.77, 0.66, 1.0], // lilac
      [1.0, 0.70, 0.82], // blush
    ],
    intensity: 0.55,
  },
};

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Domain-warped fractal noise → flowing aurora bands, tinted across 4 colours.
const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform float uIntensity;
  uniform vec3  uBase;
  uniform vec3  uC0;
  uniform vec3  uC1;
  uniform vec3  uC2;
  uniform vec3  uC3;

  // hash + value noise
  vec2 hash22(vec2 p){
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
  }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(dot(hash22(i+vec2(0,0)), f-vec2(0,0)),
                   dot(hash22(i+vec2(1,0)), f-vec2(1,0)), u.x),
               mix(dot(hash22(i+vec2(0,1)), f-vec2(0,1)),
                   dot(hash22(i+vec2(1,1)), f-vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0; float a = 0.5;
    for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main(){
    // aspect-correct, centred coords
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0);

    float t = uTime * 0.06;
    vec2 m = uMouse * 0.35;

    // domain warp
    vec2 q = vec2(fbm(p*1.4 + vec2(0.0, t) + m),
                  fbm(p*1.4 + vec2(5.2, -t) - m));
    vec2 r = vec2(fbm(p*1.8 + 1.7*q + vec2(1.7, 9.2) + t*1.3),
                  fbm(p*1.8 + 1.7*q + vec2(8.3, 2.8) - t*1.1));
    float f = fbm(p*1.6 + 2.4*r + t);

    // three soft bands → mix the four palette colours
    float b0 = smoothstep(0.0, 0.9, f + 0.25*sin(t*2.0 + p.x*1.5));
    float b1 = smoothstep(0.1, 1.0, length(q));
    float b2 = smoothstep(0.0, 1.0, r.x*0.5 + 0.5);

    vec3 col = uBase;
    col = mix(col, uC0, clamp(b0, 0.0, 1.0));
    col = mix(col, uC1, clamp(b1*0.85, 0.0, 1.0));
    col = mix(col, uC2, clamp(b2*0.7, 0.0, 1.0));
    col = mix(col, uC3, clamp(pow(f*0.5+0.5, 3.0), 0.0, 1.0));

    // glow toward the brighter ribbons
    float glow = smoothstep(0.35, 1.0, f*0.5+0.5);
    col += glow * 0.18 * uIntensity;

    // overall strength + gentle radial vignette
    float vig = smoothstep(1.25, 0.2, length(uv-0.5));
    col = mix(uBase, col, uIntensity * (0.55 + 0.45*vig));

    // subtle dither to kill banding on gradients
    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - 0.5) / 255.0;
    col += dither;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function AuroraBackground({ variant }: { variant: Variant }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    // Load three + gsap together, then wire up the scene.
    Promise.all([import("three"), import("gsap")]).then(([THREE, gsapMod]) => {
      if (disposed || !host) return;
      const gsap = gsapMod.gsap ?? gsapMod.default;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
      } catch {
        return; // no WebGL — the CSS base colour already fills the page
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr);
      const canvas = renderer.domElement;
      canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;display:block;opacity:0;";
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      const pal = PALETTES[variant];
      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uIntensity: { value: pal.intensity },
        uBase: { value: new THREE.Vector3(...pal.base) },
        uC0: { value: new THREE.Vector3(...pal.colors[0]) },
        uC1: { value: new THREE.Vector3(...pal.colors[1]) },
        uC2: { value: new THREE.Vector3(...pal.colors[2]) },
        uC3: { value: new THREE.Vector3(...pal.colors[3]) },
      };
      const geo = new THREE.PlaneGeometry(2, 2);
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        uniforms.uRes.value.set(w * dpr, h * dpr);
      }
      resize();
      window.addEventListener("resize", resize);

      // cursor parallax — eased target the shader leans toward
      const target = { x: 0, y: 0 };
      function onPointer(e: PointerEvent) {
        target.x = (e.clientX / window.innerWidth) * 2 - 1;
        target.y = -((e.clientY / window.innerHeight) * 2 - 1);
        gsap.to(uniforms.uMouse.value, { x: target.x, y: target.y, duration: 1.4, ease: "power2.out", overwrite: true });
      }
      window.addEventListener("pointermove", onPointer, { passive: true });

      // fade the canvas in
      gsap.to(canvas, { opacity: 1, duration: 1.1, ease: "power2.out" });

      let raf = 0;
      const start = performance.now();
      function frame(now: number) {
        uniforms.uTime.value = (now - start) / 1000;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      }
      function play() { if (!raf && !reduce) raf = requestAnimationFrame(frame); }
      function pause() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      function onVis() { document.hidden ? pause() : play(); }
      document.addEventListener("visibilitychange", onVis);

      if (reduce) {
        renderer.render(scene, camera); // one static frame
      } else {
        play();
      }

      cleanup = () => {
        pause();
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVis);
        gsap.killTweensOf(canvas);
        gsap.killTweensOf(uniforms.uMouse.value);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        canvas.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [variant]);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
