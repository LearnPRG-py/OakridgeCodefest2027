import * as THREE from "three";

type FrameCallback = (dt: number, elapsed: number) => void;

// Three scene lifecycle
export class DepthScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  private canvas: HTMLCanvasElement;
  private resizeObserver: ResizeObserver;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private onFrame: FrameCallback | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 9);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    this.handleResize();

    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === "visible") this.start();
    else this.stop();
  };

  private handleResize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setFrameCallback(cb: FrameCallback) {
    this.onFrame = cb;
  }

  start() {
    if (this.raf !== 0 || this.disposed) return;
    this.clock.getDelta(); // discard the paused-time delta
    const loop = () => {
      if (this.disposed || document.visibilityState !== "visible") {
        this.raf = 0;
        return;
      }
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.getElapsedTime();
      this.onFrame?.(dt, elapsed);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
