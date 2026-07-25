import { gsap } from "gsap";
import { triggerWaterSplash } from "../three/homeDepth";

// Splash effects

const IGNORE_SELECTOR = "a, button, input, textarea, select, .glass, [data-no-splash]";
const LAYER_ID = "splash-layer";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getLayer(): HTMLElement {
  let layer = document.getElementById(LAYER_ID);
  if (!layer) {
    layer = document.createElement("div");
    layer.id = LAYER_ID;
    layer.className = "pointer-events-none fixed inset-0 z-[60] overflow-hidden";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function spawnDroplets(x: number, y: number) {
  if (prefersReducedMotion()) return;

  const layer = getLayer();
  const wrap = document.createElement("div");
  wrap.style.position = "absolute";
  wrap.style.left = `${x}px`;
  wrap.style.top = `${y}px`;
  layer.appendChild(wrap);

  const dropletCount = 7;
  for (let i = 0; i < dropletCount; i++) {
    const angle = (Math.PI * 2 * i) / dropletCount + (Math.random() - 0.5) * 0.6;
    const dist = 16 + Math.random() * 30;
    const size = 2.5 + Math.random() * 2.5;
    const dot = document.createElement("span");
    dot.style.position = "absolute";
    dot.style.left = "0";
    dot.style.top = "0";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.borderRadius = "9999px";
    dot.style.background = "radial-gradient(circle at 35% 30%, #eafaff, #2ee6d6 70%)";
    dot.style.boxShadow = "0 0 6px rgba(46, 230, 214, 0.6)";
    wrap.appendChild(dot);

    gsap.set(dot, { xPercent: -50, yPercent: -50, opacity: 1 });
    const flightX = Math.cos(angle) * dist;
    const riseY = Math.sin(angle) * dist * 0.4 - 22 - Math.random() * 10;
    const tl = gsap.timeline();
    tl.to(dot, { x: flightX * 0.6, y: riseY, duration: 0.28, ease: "power2.out" }).to(dot, {
      x: flightX,
      y: riseY + 26,
      opacity: 0,
      scale: 0.4,
      duration: 0.4,
      ease: "power1.in",
    });
  }

  setTimeout(() => wrap.remove(), 900);
}

function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest(IGNORE_SELECTOR)) return;
  triggerWaterSplash(e.clientX, e.clientY);
  spawnDroplets(e.clientX, e.clientY);
}

// Home-only splash binding
function bind() {
  if (document.getElementById("home-hero")) {
    document.addEventListener("click", onClick);
  }
}

function unbind() {
  document.removeEventListener("click", onClick);
  document.getElementById(LAYER_ID)?.remove();
}

document.addEventListener("astro:page-load", bind);
document.addEventListener("astro:before-swap", unbind);
