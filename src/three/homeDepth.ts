import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OceanShader } from "./oceanShader";
import { DepthScene } from "./sceneManager";
import { createShark } from "./shark";
import { createMoteField, createCodeFragments } from "./particles";
import { createLightShaft } from "./lightShaft";

gsap.registerPlugin(ScrollTrigger);

function capableOfDepthEngine(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.WebGLRenderingContext) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) return false;
  if (nav.connection?.saveData) return false;
  return true;
}

let oceanShader: OceanShader | null = null;
let depthScene: DepthScene | null = null;
let scrollTriggers: ScrollTrigger[] = [];
// Navigation guard
let initToken = 0;

// Splash bridge
export function triggerWaterSplash(clientX: number, clientY: number) {
  oceanShader?.addSplash(clientX, clientY);
}

function teardown() {
  initToken++;
  scrollTriggers.forEach((t) => t.kill());
  scrollTriggers = [];
  oceanShader?.dispose();
  oceanShader = null;
  depthScene?.dispose();
  depthScene = null;
}

function init() {
  teardown();
  const token = ++initToken;

  const root = document.getElementById("depth-engine-root");
  const oceanCanvas = document.getElementById("ocean-canvas") as HTMLCanvasElement | null;
  const sceneCanvas = document.getElementById("scene-canvas") as HTMLCanvasElement | null;
  if (!root || !oceanCanvas || !sceneCanvas) return;

  if (!capableOfDepthEngine()) {
    root.classList.add("hidden");
    gsap.set("#home-hero [data-reveal-hero]", { opacity: 1, y: 0 });
    return;
  }
  root.classList.remove("hidden");

  oceanShader = new OceanShader(oceanCanvas, { cursorEnabled: true, intensity: 0.5 });

  depthScene = new DepthScene(sceneCanvas);
  const { scene, camera } = depthScene;
  const REST_FOG = { near: 4, far: 15 };
  // Shark scale
  const SHARK_SCALE = 3.7;
  // Swim path reference width
  const PATH_REF_HALF_WIDTH = 6.6;
  // Shark frame bounds
  const SHARK_HALF_EXTENT = 0.63;

  scene.fog = new THREE.Fog(0x05080a, REST_FOG.near, REST_FOG.far);

  const ambient = new THREE.AmbientLight(0x2ee6d6, 0.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xeaf9ff, 0.6);
  key.position.set(2, 4, 6);
  scene.add(key);

  const shark = createShark();
  shark.group.scale.setScalar(SHARK_SCALE);
  scene.add(shark.group);

  // Swim path
  const swimPath = new THREE.CatmullRomCurve3(
    [
      // Hero
      new THREE.Vector3(5.0, 1.6, -3.4),
      new THREE.Vector3(2.8, -0.6, -2.8),
      // Descent
      new THREE.Vector3(-1.2, -2.8, -3.2),
      new THREE.Vector3(2.2, -4.8, -3.8),
      new THREE.Vector3(-2.6, -4.2, -3.0),
      // Surface
      new THREE.Vector3(1.8, -1.4, -2.6),
    ],
    false,
    "catmullrom",
    0.5,
  );

  const pathPos = new THREE.Vector3();
  const pathTangent = new THREE.Vector3();
  const revealOffset = { x: 2.4, y: 2.6, z: -4.5 };
  // Reveal scale
  const revealState = { scale: 1 };

  let scrollTarget = 0;
  let scrollSmooth = 0;
  let swimEffort = 0;

  const pathTrigger = ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      scrollTarget = self.progress;
    },
  });
  scrollTriggers.push(pathTrigger);

  const lightShaft = createLightShaft();
  lightShaft.position.set(1.4, -1.2, -3);
  scene.add(lightShaft);

  const motes = createMoteField();
  scene.add(motes);

  const codeFragments = createCodeFragments();
  scene.add(codeFragments.group);

  depthScene.setFrameCallback((dt, elapsed) => {
    // Scroll smoothing
    const follow = 1 - Math.exp(-dt * 2.4);
    const prevSmooth = scrollSmooth;
    scrollSmooth += (scrollTarget - scrollSmooth) * follow;

    const t = THREE.MathUtils.clamp(scrollSmooth, 0, 1);
    swimPath.getPointAt(t, pathPos);
    swimPath.getTangentAt(t, pathTangent);

    const halfH = Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - pathPos.z);
    const halfW = halfH * camera.aspect;
    const fit = THREE.MathUtils.clamp(halfW / PATH_REF_HALF_WIDTH, 0, 1);

    // Responsive scale
    const baseScale = SHARK_SCALE * Math.max(fit, 0.45);
    shark.group.scale.setScalar(baseScale * revealState.scale);

    pathPos.x *= fit;

    // Idle drift
    pathPos.x += Math.sin(elapsed * 0.31) * 0.28 * fit;
    pathPos.y += Math.sin(elapsed * 0.47 + 2.1) * 0.22;
    pathPos.z += Math.cos(elapsed * 0.27) * 0.2;

    pathPos.x += revealOffset.x * fit;
    pathPos.y += revealOffset.y;
    pathPos.z += revealOffset.z;

    // Viewport clamp
    const halfExtent = baseScale * SHARK_HALF_EXTENT;
    const maxX = Math.max(0, halfW - halfExtent * 0.75);
    pathPos.x = THREE.MathUtils.clamp(pathPos.x, -maxX, maxX);
    shark.group.position.copy(pathPos);

    // Swim effort
    const speed = Math.abs(scrollSmooth - prevSmooth) / Math.max(dt, 1e-4);
    swimEffort += (Math.min(speed * 6, 1) - swimEffort) * (1 - Math.exp(-dt * 2.5));
    shark.material.uniforms.u_swimSpeed.value = 2.2 + swimEffort * 5.5;
    shark.material.uniforms.u_swimAmount.value = 0.05 + swimEffort * 0.045;

    shark.steer(pathTangent, dt);
    shark.update(elapsed, dt);
    (motes.userData.update as (e: number) => void)(elapsed);
    codeFragments.update(elapsed);
  });
  depthScene.start();

  // Hero reveal
  function playHeroReveal() {
    if (token !== initToken) return;
    if (prefersReducedMotion()) {
      gsap.set("#home-hero [data-reveal-hero]", { opacity: 1, y: 0 });
      return;
    }

    gsap.set(revealState, { scale: 0.6 });
    gsap.set(shark.material.uniforms.u_reveal, { value: 0.06 });
    gsap.set(scene.fog, { near: 1, far: 5.5 });
    gsap.set(ambient, { intensity: 0.12 });
    gsap.set(key, { intensity: 0 });
    gsap.set(camera.position, { z: 10.6 });
    gsap.set("#home-hero [data-reveal-hero]", { opacity: 0, y: 18 });

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
    tl.to(lightShaft.material, { opacity: 0.85, duration: 1.3, ease: "power2.inOut" }, 0.15)
      .to(ambient, { intensity: 0.35, duration: 1.6 }, 0.2)
      .to(key, { intensity: 0.6, duration: 1.6 }, 0.3)
      .to(scene.fog, { near: REST_FOG.near, far: REST_FOG.far, duration: 1.8, ease: "power2.inOut" }, 0.2)
      // Entry glide
      .to(revealOffset, { x: 0, y: 0, z: 0, duration: 2.2, ease: "power3.out" }, 0.1)
      .to(revealState, { scale: 1, duration: 2, ease: "power3.out" }, 0.1)
      .to(shark.material.uniforms.u_reveal, { value: 1, duration: 1.7, ease: "power2.in" }, 0.2)
      .to(camera.position, { z: 9, duration: 2, ease: "power2.inOut" }, 0.1)
      .to(lightShaft.material, { opacity: 0, duration: 1, ease: "power1.in" }, 1.9)
      .to(
        "#home-hero [data-reveal-hero]",
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power2.out" },
        1.7,
      );
  }

  const preloaderDone = new Promise<void>((resolve) => {
    if (!document.getElementById("preloader")) return resolve();
    document.addEventListener("codefest:preloader-done", () => resolve(), { once: true });
  });
  // Reveal readiness
  const safety = new Promise<void>((resolve) => setTimeout(resolve, 6000));
  Promise.race([Promise.all([preloaderDone, shark.ready]), safety]).then(playHeroReveal);

  // Scroll descent
  const descentTl = gsap.timeline({
    scrollTrigger: {
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
    },
  });
  descentTl
    .to(camera.position, { y: -2.6, z: 6.2, ease: "none", duration: 1 }, 0)
    .to(scene.fog, { near: 2, far: 10, ease: "none", duration: 1 }, 0)
    .to(oceanShader, { intensity: 0.85, ease: "none", duration: 1 }, 0)
    .to(camera.position, { y: 0.4, z: 9, ease: "none", duration: 1 }, 1)
    .to(scene.fog, { near: REST_FOG.near, far: REST_FOG.far, ease: "none", duration: 1 }, 1)
    .to(oceanShader, { intensity: 0.5, ease: "none", duration: 1 }, 1);
  if (descentTl.scrollTrigger) scrollTriggers.push(descentTl.scrollTrigger);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", teardown);
