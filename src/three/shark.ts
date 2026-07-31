import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Shark model
const MODEL_URL = "/models/shark.glb";

// Model bounds
const NOSE_Z = 0.494;
const TAIL_Z = -0.493;

const FRESNEL_FRAG = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  uniform vec3 u_baseColor;
  uniform vec3 u_glowColor;
  uniform float u_time;
  uniform float u_reveal;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.4);
    float pulse = 0.88 + 0.12 * sin(u_time * 1.4);
    vec3 color = mix(u_baseColor, u_glowColor, clamp(fresnel * pulse, 0.0, 1.0));
    float brightness = mix(0.05, 1.0, clamp(u_reveal, 0.0, 1.0));
    gl_FragColor = vec4(color * brightness, 1.0);
  }
`;

// Swim deformation
const SWIM_VERT = `
  uniform float u_time;
  uniform float u_swimSpeed;
  uniform float u_swimAmount;
  uniform float u_waveFreq;
  uniform float u_noseZ;
  uniform float u_tailZ;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 pos = position;

    float taper = clamp((u_noseZ - pos.z) / (u_noseZ - u_tailZ), 0.0, 1.0);
    taper = taper * taper;

    float phase = pos.z * u_waveFreq + u_time * u_swimSpeed;
    float wave = sin(phase) * u_swimAmount * taper;
    pos.x += wave;

    // Normal wave slope
    float slope = cos(phase) * u_waveFreq * u_swimAmount * taper;
    vec3 n = normalize(normal + vec3(-slope, 0.0, 0.0) * 0.6);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * n;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export interface Shark {
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  ready: Promise<void>;
  loaded: boolean;
  
  headUpPitch: number;
  update(elapsed: number, dt: number): void;
  steer(direction: THREE.Vector3, dt: number): void;
}

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();

export function createShark(): Shark {
  const group = new THREE.Group();
  // Steering groups
  const steerGroup = new THREE.Group();
  group.add(steerGroup);
  // Orientation fix
  const bodyGroup = new THREE.Group();
  bodyGroup.rotation.y = Math.PI;
  steerGroup.add(bodyGroup);

  const material = new THREE.ShaderMaterial({
    vertexShader: SWIM_VERT,
    fragmentShader: FRESNEL_FRAG,
    uniforms: {
      u_time: { value: 0 },
      u_baseColor: { value: new THREE.Color("#03211d") },
      u_glowColor: { value: new THREE.Color("#2ee6d6") },
      u_reveal: { value: 1 },
      u_swimSpeed: { value: 2.4 },
      u_swimAmount: { value: 0.055 },
      u_waveFreq: { value: 7.0 },
      u_noseZ: { value: NOSE_Z },
      u_tailZ: { value: TAIL_Z },
    },
  });

  const shark: Shark = {
    group,
    material,
    loaded: false,
    ready: Promise.resolve(),
    headUpPitch: 1.02,
    update() {},
    steer() {},
  };

  shark.ready = new Promise<void>((resolve) => {
    new GLTFLoader().load(
      MODEL_URL,
      (gltf) => {
        let mesh: THREE.Mesh | null = null;
        gltf.scene.traverse((obj) => {
          if (!mesh && (obj as THREE.Mesh).isMesh) mesh = obj as THREE.Mesh;
        });
        if (mesh) {
          const found = mesh as THREE.Mesh;
          gltf.scene.updateWorldMatrix(true, true);
          const geometry = found.geometry.clone();
          geometry.applyMatrix4(found.matrixWorld);
          geometry.computeBoundingBox();
          bodyGroup.add(new THREE.Mesh(geometry, material));
          shark.loaded = true;
        }
        resolve();
      },
      undefined,
      () => resolve(),
    );
  });

  // Steering state
  const heading = new THREE.Vector3(0, 0, -1);
  const desired = new THREE.Vector3();
  const lookMatrix = new THREE.Matrix4();
  const targetQuat = new THREE.Quaternion();
  const bankQuat = new THREE.Quaternion();
  const forwardAxis = new THREE.Vector3(0, 0, -1);
  let prevYaw = 0;
  let bank = 0;

  const horiz = new THREE.Vector3();

  shark.steer = (direction: THREE.Vector3, dt: number) => {
    if (direction.lengthSq() < 1e-8) return;

    // Head-up steering
    horiz.set(direction.x, 0, direction.z);
    if (horiz.lengthSq() < 1e-8) horiz.set(0, 0, -1);
    horiz.normalize();
    const pitch = shark.headUpPitch;
    desired.set(horiz.x * Math.cos(pitch), Math.sin(pitch), horiz.z * Math.cos(pitch)).normalize();

    // Smooth turn
    const k = 1 - Math.exp(-dt * 2.6);
    heading.lerp(desired, k);
    if (heading.lengthSq() < 1e-8) return;
    heading.normalize();

    lookMatrix.lookAt(ORIGIN, heading, UP);
    targetQuat.setFromRotationMatrix(lookMatrix);

    // Bank roll
    const yaw = Math.atan2(heading.x, heading.z);
    let dYaw = yaw - prevYaw;
    if (dYaw > Math.PI) dYaw -= Math.PI * 2;
    if (dYaw < -Math.PI) dYaw += Math.PI * 2;
    prevYaw = yaw;
    const targetBank = THREE.MathUtils.clamp((dYaw / Math.max(dt, 1e-4)) * 0.45, -0.7, 0.7);
    bank += (targetBank - bank) * (1 - Math.exp(-dt * 3.2));

    bankQuat.setFromAxisAngle(forwardAxis, bank);
    targetQuat.multiply(bankQuat);
    steerGroup.quaternion.copy(targetQuat);
  };

  shark.update = (elapsed: number) => {
    material.uniforms.u_time.value = elapsed;
    // Idle motion
    bodyGroup.rotation.z = Math.sin(elapsed * 0.55) * 0.07;
    bodyGroup.rotation.x = Math.sin(elapsed * 0.42 + 1.1) * 0.045;
    bodyGroup.position.y = Math.sin(elapsed * 0.7) * 0.035;
  };

  return shark;
}
