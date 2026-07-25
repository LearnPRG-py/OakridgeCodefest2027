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

// Splash bridge
export function triggerWaterSplash(clientX: number, clientY: number) {
  oceanShader?.addSplash(clientX, clientY);
}

function teardown() {
  scrollTriggers.forEach((t) => t.kill());
  scrollTriggers = [];
  oceanShader?.dispose();
  oceanShader = null;
  depthScene?.dispose();
  depthScene = null;
}

function init() {
  teardown();

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
  const REST_SHARK = { x: 0.6, y: -2.7, z: -2.2, rotY: -0.4, scale: 0.95 };

  scene.fog = new THREE.Fog(0x05080a, REST_FOG.near, REST_FOG.far);

  const ambient = new THREE.AmbientLight(0x2ee6d6, 0.35);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xeaf9ff, 0.6);
  key.position.set(2, 4, 6);
  scene.add(key);

  const shark = createShark();
  shark.group.scale.setScalar(REST_SHARK.scale);
  shark.group.position.set(REST_SHARK.x, REST_SHARK.y, REST_SHARK.z);
  shark.group.rotation.y = REST_SHARK.rotY;
  scene.add(shark.group);

  const lightShaft = createLightShaft();
  lightShaft.position.set(1.4, -1.2, -3);
  scene.add(lightShaft);

  const motes = createMoteField();
  scene.add(motes);

  const codeFragments = createCodeFragments();
  scene.add(codeFragments.group);

  depthScene.setFrameCallback((_dt, elapsed) => {
    shark.update(elapsed);
    (motes.userData.update as (e: number) => void)(elapsed);
    codeFragments.update(elapsed);
  });
  depthScene.start();
  // Hero reveal
  function playHeroReveal() {
    if (prefersReducedMotion()) {
      gsap.set("#home-hero [data-reveal-hero]", { opacity: 1, y: 0 });
      return;
    }

    gsap.set(shark.group.position, { x: 3.4, y: 1, z: -6 });
    gsap.set(shark.group.rotation, { y: -1.6 });
    gsap.set(shark.group.scale, { x: 0.65, y: 0.65, z: 0.65 });
    gsap.set(shark.bodyMaterial.uniforms.u_reveal, { value: 0.06 });
    gsap.set(shark.finMaterial.uniforms.u_reveal, { value: 0.06 });
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
      .to(
        shark.group.position,
        { x: REST_SHARK.x, y: REST_SHARK.y, z: REST_SHARK.z, duration: 1.9, ease: "power3.out" },
        0.1,
      )
      .to(shark.group.rotation, { y: REST_SHARK.rotY, duration: 1.9, ease: "power3.out" }, 0.1)
      .to(shark.group.scale, { x: REST_SHARK.scale, y: REST_SHARK.scale, z: REST_SHARK.scale, duration: 1.9 }, 0.1)
      .to(shark.bodyMaterial.uniforms.u_reveal, { value: 1, duration: 1.7, ease: "power2.in" }, 0.2)
      .to(shark.finMaterial.uniforms.u_reveal, { value: 1, duration: 1.7, ease: "power2.in" }, 0.2)
      .to(camera.position, { z: 9, duration: 2, ease: "power2.inOut" }, 0.1)
      .to(lightShaft.material, { opacity: 0, duration: 1, ease: "power1.in" }, 1.9)
      .to(
        "#home-hero [data-reveal-hero]",
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power2.out" },
        1.7,
      );
  }

  const preloader = document.getElementById("preloader");
  if (preloader) {
    document.addEventListener("codefest:preloader-done", playHeroReveal, { once: true });
  } else {
    playHeroReveal();
  }
  // Scroll depth
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
    .to(shark.group.position, { y: -4.6, z: -3.6, ease: "none", duration: 1 }, 0)
    .to(camera.position, { y: 0.4, z: 9, ease: "none", duration: 1 }, 1)
    .to(scene.fog, { near: REST_FOG.near, far: REST_FOG.far, ease: "none", duration: 1 }, 1)
    .to(oceanShader, { intensity: 0.5, ease: "none", duration: 1 }, 1)
    .to(shark.group.position, { y: REST_SHARK.y, z: REST_SHARK.z, ease: "none", duration: 1 }, 1);
  if (descentTl.scrollTrigger) scrollTriggers.push(descentTl.scrollTrigger);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", teardown);
