import { gsap } from "gsap";
import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

// Dive wipe

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setClip(el: HTMLElement, percent: number, xPct: number, yPct: number) {
  el.style.clipPath = `circle(${percent}% at ${xPct}% ${yPct}%)`;
}

document.addEventListener("astro:before-preparation", (e: Event) => {
  const event = e as TransitionBeforePreparationEvent;
  const wipe = document.getElementById("dive-wipe");
  if (!wipe) return;

  const rect = (event.sourceElement as HTMLElement | undefined)?.getBoundingClientRect();
  const xPct = rect ? ((rect.left + rect.width / 2) / window.innerWidth) * 100 : 50;
  const yPct = rect ? ((rect.top + rect.height / 2) / window.innerHeight) * 100 : 50;

  if (prefersReducedMotion()) {
    setClip(wipe, 150, xPct, yPct);
    return;
  }

  const originalLoader = event.loader;
  event.loader = async () => {
    const proxy = { p: 0 };
    await gsap.to(proxy, {
      p: 150,
      duration: 0.5,
      ease: "power2.in",
      onUpdate: () => setClip(wipe, proxy.p, xPct, yPct),
    });
    await originalLoader();
  };
});

document.addEventListener("astro:after-swap", () => {
  const wipe = document.getElementById("dive-wipe");
  if (!wipe) return;

  if (prefersReducedMotion()) {
    setClip(wipe, 0, 50, 50);
    return;
  }

  const match = wipe.style.clipPath.match(/circle\(([\d.]+)% at ([\d.]+)% ([\d.]+)%\)/);
  const [, p = "150", x = "50", y = "50"] = match ?? [];
  const proxy = { p: Number(p) };
  gsap.to(proxy, {
    p: 0,
    duration: 0.6,
    delay: 0.05,
    ease: "power2.out",
    onUpdate: () => setClip(wipe, proxy.p, Number(x), Number(y)),
  });
});
