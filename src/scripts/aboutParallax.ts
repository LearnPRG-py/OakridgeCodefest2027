import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const TRIGGER_PREFIX = "about-parallax:";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function killAboutParallax() {
  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.vars.id?.startsWith(TRIGGER_PREFIX)) trigger.kill();
  });
}

function numberFromDataset(el: HTMLElement, key: string, fallback: number) {
  const value = Number(el.dataset[key]);
  return Number.isFinite(value) ? value : fallback;
}

function initDepthLayers() {
  document.querySelectorAll<HTMLElement>("[data-about-parallax]").forEach((el, index) => {
    const y = numberFromDataset(el, "aboutY", 0);
    const x = numberFromDataset(el, "aboutX", 0);
    const scale = numberFromDataset(el, "aboutScale", 1);
    const rotate = numberFromDataset(el, "aboutRotate", 0);

    gsap.fromTo(
      el,
      { x: -x * 0.5, y: -y * 0.5, scale: scale === 1 ? 1 : 1 + (scale - 1) * 0.35, rotate: -rotate * 0.5 },
      {
        x: x * 0.5,
        y: y * 0.5,
        scale,
        rotate,
        ease: "none",
        scrollTrigger: {
          id: `${TRIGGER_PREFIX}layer-${index}`,
          trigger: el.closest("section") ?? el,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.55,
        },
      },
    );
  });
}

function initBenefitCards() {
  document.querySelectorAll<HTMLElement>("[data-about-card]").forEach((card, index) => {
    const y = numberFromDataset(card, "aboutY", 24);

    gsap.fromTo(
      card,
      { y: -y * 0.45, filter: "brightness(0.9)" },
      {
        y: y * 0.45,
        filter: "brightness(1.08)",
        ease: "none",
        scrollTrigger: {
          id: `${TRIGGER_PREFIX}card-${index}`,
          trigger: card,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.7,
        },
      },
    );
  });
}

function initGalleryRows() {
  document.querySelectorAll<HTMLElement>("[data-about-gallery-row]").forEach((row, index) => {
    const x = numberFromDataset(row, "aboutX", 60);

    gsap.fromTo(
      row,
      { x },
      {
        x: -x,
        ease: "none",
        scrollTrigger: {
          id: `${TRIGGER_PREFIX}gallery-${index}`,
          trigger: row,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      },
    );
  });
}

function initSceneScrub() {
  document.querySelectorAll<HTMLElement>("[data-about-scene]").forEach((scene, index) => {
    gsap.fromTo(
      scene,
      { "--about-scan": "0%" },
      {
        "--about-scan": "100%",
        ease: "none",
        scrollTrigger: {
          id: `${TRIGGER_PREFIX}scene-${index}`,
          trigger: scene,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      },
    );
  });
}

function resetParallax() {
  gsap.set("[data-about-parallax], [data-about-card]", { clearProps: "transform,filter" });
  gsap.set("[data-about-gallery-row]", { clearProps: "transform" });
}

function init() {
  killAboutParallax();
  resetParallax();

  if (prefersReducedMotion() || !document.querySelector("[data-about-scene]")) return;

  initDepthLayers();
  initBenefitCards();
  initGalleryRows();
  initSceneScrub();
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  killAboutParallax();
  resetParallax();
});
