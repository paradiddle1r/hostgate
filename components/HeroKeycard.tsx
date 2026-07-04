"use client";

// Photoreal floating hotel keycards behind the hero headline (Three.js).
// Two clear-coated cards drift and slowly rotate in studio lighting
// (RoomEnvironment reflections), lean toward the cursor, and cast a soft
// contact shadow. Desktop-only (lg + fine pointer), loaded after idle so it
// never competes with the hero LCP, static single frame under
// prefers-reduced-motion, full dispose on unmount. pointer-events: none —
// purely decorative.

import { useEffect, useRef } from "react";

export default function HeroKeycard() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Desktop + mouse only — phones get the (lighter) static hero.
    if (!window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) return;

    let disposed = false;
    let cleanup = () => {};

    const start = () => {
      Promise.all([import("three"), import("gsap")]).then(([THREE, gsapMod]) => {
        if (disposed || !host) return;
        const gsap = gsapMod.gsap ?? gsapMod.default;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        let renderer: import("three").WebGLRenderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        } catch {
          return; // no WebGL — hero simply stays as-is
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const canvas = renderer.domElement;
        canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;";
        host.appendChild(canvas);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
        camera.position.set(0, 0.1, 9);

        // Studio reflections — the thing that makes the plastic read as real.
        const pmrem = new THREE.PMREMGenerator(renderer);
        import("three/examples/jsm/environments/RoomEnvironment.js")
          .then(({ RoomEnvironment }) => {
            if (disposed) return;
            scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          })
          .catch(() => { /* reflections are a bonus, not a requirement */ });

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.35);
        key.position.set(4, 6, 6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xbcd3ff, 0.5);
        rim.position.set(-5, -2, -4);
        scene.add(rim);

        // ── card front artwork (canvas texture) ────────────────────────────
        function frontTexture() {
          const c = document.createElement("canvas");
          c.width = 1024; c.height = 640;
          const g = c.getContext("2d")!;
          const grad = g.createLinearGradient(0, 0, 1024, 640);
          grad.addColorStop(0, "#4f46e5");
          grad.addColorStop(0.55, "#6366f1");
          grad.addColorStop(1, "#8b5cf6");
          g.fillStyle = grad;
          g.fillRect(0, 0, 1024, 640);
          // sheen band
          g.fillStyle = "rgba(255,255,255,0.10)";
          g.beginPath();
          g.moveTo(560, 0); g.lineTo(780, 0); g.lineTo(420, 640); g.lineTo(200, 640);
          g.closePath(); g.fill();
          // fine guilloché-ish lines
          g.strokeStyle = "rgba(255,255,255,0.07)";
          g.lineWidth = 2;
          for (let i = -8; i < 22; i++) {
            g.beginPath();
            g.moveTo(i * 90, 700); g.bezierCurveTo(i * 90 + 200, 380, i * 90 + 260, 260, i * 90 + 520, -60);
            g.stroke();
          }
          // chip
          const chip = g.createLinearGradient(96, 240, 220, 340);
          chip.addColorStop(0, "#f5d97b"); chip.addColorStop(1, "#c9a548");
          g.fillStyle = chip;
          g.beginPath(); g.roundRect(96, 244, 128, 96, 14); g.fill();
          g.strokeStyle = "rgba(80,60,10,0.45)"; g.lineWidth = 3;
          g.beginPath();
          g.moveTo(96, 292); g.lineTo(224, 292);
          g.moveTo(140, 244); g.lineTo(140, 340);
          g.moveTo(180, 244); g.lineTo(180, 340);
          g.stroke();
          // wordmark
          g.fillStyle = "#ffffff";
          g.font = "600 64px Inter, system-ui, sans-serif";
          g.fillText("HostGate", 92, 140);
          g.font = "500 30px Inter, system-ui, sans-serif";
          g.fillStyle = "rgba(255,255,255,0.85)";
          g.fillText("ROOM KEY", 92, 190);
          g.font = "500 34px Inter, system-ui, sans-serif";
          g.fillText("SUITE  •  2 4 0 1", 92, 560);
          const t = new THREE.CanvasTexture(c);
          t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }
        function backTexture() {
          const c = document.createElement("canvas");
          c.width = 1024; c.height = 640;
          const g = c.getContext("2d")!;
          g.fillStyle = "#eef0f6"; g.fillRect(0, 0, 1024, 640);
          g.fillStyle = "#23262f"; g.fillRect(0, 84, 1024, 130); // magstripe
          g.fillStyle = "#c7cad4"; g.fillRect(72, 300, 620, 64);  // signature
          g.fillStyle = "#9aa0af";
          g.font = "500 28px Inter, system-ui, sans-serif";
          g.fillText("hostgate.app", 72, 560);
          const t = new THREE.CanvasTexture(c);
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        }

        // ── card mesh: extruded rounded rect + front/back decals ───────────
        const disposables: { dispose: () => void }[] = [];
        function makeCard() {
          const W = 3.42, H = 2.14, R = 0.16, D = 0.045;
          const s = new THREE.Shape();
          const x = -W / 2, y = -H / 2;
          s.moveTo(x + R, y);
          s.lineTo(x + W - R, y); s.quadraticCurveTo(x + W, y, x + W, y + R);
          s.lineTo(x + W, y + H - R); s.quadraticCurveTo(x + W, y + H, x + W - R, y + H);
          s.lineTo(x + R, y + H); s.quadraticCurveTo(x, y + H, x, y + H - R);
          s.lineTo(x, y + R); s.quadraticCurveTo(x, y, x + R, y);
          const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
          geo.translate(0, 0, -D / 2);
          const body = new THREE.MeshPhysicalMaterial({
            color: 0xf2f3f8, roughness: 0.32, metalness: 0.05,
            clearcoat: 1, clearcoatRoughness: 0.18,
          });
          const mesh = new THREE.Mesh(geo, body);
          const ft = frontTexture(), bt = backTexture();
          const decal = (tex: import("three").Texture) => new THREE.MeshPhysicalMaterial({
            map: tex, roughness: 0.3, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.15,
          });
          const front = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.985, H * 0.985), decal(ft));
          front.position.z = D / 2 + 0.011;
          const back = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.985, H * 0.985), decal(bt));
          back.position.z = -D / 2 - 0.011;
          back.rotation.y = Math.PI;
          const grp = new THREE.Group();
          grp.add(mesh, front, back);
          disposables.push(geo, body, ft, bt, front.geometry, front.material as never, back.geometry, back.material as never);
          return grp;
        }

        // soft contact shadow (radial-gradient sprite under each card)
        function makeShadow() {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const g = c.getContext("2d")!;
          const rad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
          rad.addColorStop(0, "rgba(20,20,40,0.34)");
          rad.addColorStop(1, "rgba(20,20,40,0)");
          g.fillStyle = rad; g.fillRect(0, 0, 256, 256);
          const t = new THREE.CanvasTexture(c);
          const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
          const p = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.0), m);
          p.rotation.x = -Math.PI / 2;
          disposables.push(t, m, p.geometry);
          return p;
        }

        // main card — right of the headline
        const cardA = makeCard();
        cardA.position.set(3.45, 0.55, 0);
        cardA.rotation.set(-0.16, -0.5, -0.1);
        const shadowA = makeShadow();
        shadowA.position.set(3.45, -1.65, 0);
        // companion card — smaller, far left, opposite spin
        const cardB = makeCard();
        cardB.scale.setScalar(0.62);
        cardB.position.set(-3.75, -0.4, -1.2);
        cardB.rotation.set(0.22, 0.7, 0.14);
        const shadowB = makeShadow();
        shadowB.scale.setScalar(0.62);
        shadowB.position.set(-3.75, -1.85, -1.2);
        scene.add(cardA, shadowA, cardB, shadowB);

        // alias keeps the non-null narrowing inside the hoisted fn declaration
        const hostEl: HTMLDivElement = host;
        function resize() {
          const w = hostEl.clientWidth || 1, h = hostEl.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(hostEl);

        // cursor lean — eased targets the loop leans toward
        const lean = { x: 0, y: 0 };
        function onPointer(e: PointerEvent) {
          const nx = (e.clientX / window.innerWidth) * 2 - 1;
          const ny = (e.clientY / window.innerHeight) * 2 - 1;
          gsap.to(lean, { x: nx, y: ny, duration: 1.2, ease: "power2.out", overwrite: true });
        }
        window.addEventListener("pointermove", onPointer, { passive: true });

        gsap.to(canvas, { opacity: 1, duration: 1.2, ease: "power2.out", delay: 0.15 });

        let raf = 0;
        const t0 = performance.now();
        function frame(now: number) {
          const t = (now - t0) / 1000;
          // gentle bob + slow spin, opposite phases so they feel independent
          cardA.position.y = 0.55 + Math.sin(t * 0.8) * 0.16;
          cardA.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.38 + lean.x * 0.28;
          cardA.rotation.x = -0.16 + Math.cos(t * 0.5) * 0.07 + lean.y * 0.2;
          cardB.position.y = -0.4 + Math.sin(t * 0.65 + 1.7) * 0.13;
          cardB.rotation.y = 0.7 + Math.sin(t * 0.28 + 0.9) * 0.45 + lean.x * 0.18;
          cardB.rotation.x = 0.22 + Math.cos(t * 0.42 + 0.4) * 0.06 + lean.y * 0.14;
          // shadows track the bob (closer card → tighter, darker shadow)
          const sA = 1 - (cardA.position.y - 0.39) * 0.22;
          shadowA.scale.set(sA, sA, sA);
          (shadowA.material as import("three").MeshBasicMaterial).opacity = 0.85 * sA;
          const sB = 0.62 * (1 - (cardB.position.y + 0.53) * 0.2);
          shadowB.scale.set(sB, sB, sB);
          (shadowB.material as import("three").MeshBasicMaterial).opacity = 0.7 * sB;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(frame);
        }
        const play = () => { if (!raf && !reduce) raf = requestAnimationFrame(frame); };
        const pause = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
        const onVis = () => (document.hidden ? pause() : play());
        document.addEventListener("visibilitychange", onVis);

        if (reduce) renderer.render(scene, camera); // one still frame
        else play();

        cleanup = () => {
          pause();
          ro.disconnect();
          window.removeEventListener("pointermove", onPointer);
          document.removeEventListener("visibilitychange", onVis);
          gsap.killTweensOf(canvas);
          gsap.killTweensOf(lean);
          disposables.forEach((d) => d.dispose());
          pmrem.dispose();
          renderer.dispose();
          canvas.remove();
        };
      });
    };

    // Defer the whole 3D payload past first paint / idle.
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(start, { timeout: 1800 });
    else setTimeout(start, 350);

    return () => { disposed = true; cleanup(); };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
    />
  );
}
