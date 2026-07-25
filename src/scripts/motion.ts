import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function initLenis() {
  if (prefersReducedMotion()) return;

  lenis = new Lenis({ duration: 1.05, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

function destroyLenis() {
  lenis?.destroy();
  lenis = null;
}

function initReveals() {
  if (prefersReducedMotion()) {
    gsap.set("[data-reveal], [data-reveal-group] > *", { opacity: 1, y: 0 });
    return;
  }

  document.querySelectorAll("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 16,
      duration: 0.5,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none reverse",
      },
    });
  });

  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    gsap.from(group.children, {
      opacity: 0,
      y: 20,
      duration: 0.5,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: {
        trigger: group,
        start: "top 85%",
      },
    });
  });
}

function initMagnetic() {
  if (prefersReducedMotion()) return;

  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 16;
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "elastic.out(1, 0.4)" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "elastic.out(1, 0.4)" });

    el.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      xTo((e.clientX - rect.left - rect.width / 2) * (strength / rect.width) * 2);
      yTo((e.clientY - rect.top - rect.height / 2) * (strength / rect.height) * 2);
    });

    el.addEventListener("mouseleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

function initTilt() {
  if (prefersReducedMotion()) return;

  document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
    gsap.set(el, { transformPerspective: 800 });

    el.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      const relY = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(el, { rotateY: relX * 10, rotateX: relY * -10, duration: 0.5, ease: "power3.out", overwrite: "auto" });
    });

    el.addEventListener("mouseleave", () => {
      gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.5, ease: "power3.out", overwrite: "auto" });
    });
  });
}

function initPodiumRise() {
  document.querySelectorAll("[data-podium-group]").forEach((group) => {
    const blocks = group.querySelectorAll("[data-podium-block]");
    if (prefersReducedMotion()) {
      gsap.set(blocks, { scaleY: 1, opacity: 1 });
      return;
    }

    gsap.from(blocks, {
      scaleY: 0,
      opacity: 0,
      duration: 0.9,
      stagger: 0.15,
      ease: "power3.out",
      scrollTrigger: {
        trigger: group,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });
  });
}

function initDepthOverlay() {
  const overlay = document.getElementById("depth-overlay");
  if (!overlay || prefersReducedMotion()) return;

  gsap.to(overlay, {
    opacity: 0.9,
    ease: "none",
    scrollTrigger: {
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
    },
  });
}

function init() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  initLenis();
  initReveals();
  initMagnetic();
  initTilt();
  initPodiumRise();
  initDepthOverlay();
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

document.addEventListener("astro:before-swap", destroyLenis);
document.addEventListener("astro:page-load", init);
