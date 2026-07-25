import { gsap } from "gsap";

// Custom cursor

let xTo: gsap.QuickToFunc | null = null;
let yTo: gsap.QuickToFunc | null = null;
let bound = false;

function isEligible(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return true;
}

const onPointerMove = (e: PointerEvent) => {
  xTo?.(e.clientX);
  yTo?.(e.clientY);
};

const onOver = (e: MouseEvent) => {
  const cursor = document.getElementById("custom-cursor");
  if (!cursor) return;
  const target = (e.target as HTMLElement)?.closest?.("a, button, [data-cursor-hover]");
  cursor.classList.toggle("cursor-hover", Boolean(target));
};

function teardown() {
  if (!bound) return;
  window.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("mouseover", onOver);
  document.body.style.cursor = "";
  bound = false;
}

function init() {
  teardown();

  const cursor = document.getElementById("custom-cursor");
  if (!cursor || !isEligible()) return;

  gsap.set(cursor, { xPercent: -50, yPercent: -50 });
  xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3.out" });
  yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3.out" });

  cursor.classList.remove("hidden");
  cursor.classList.add("cursor-active");
  document.body.style.cursor = "none";

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("mouseover", onOver);
  bound = true;
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", teardown);
