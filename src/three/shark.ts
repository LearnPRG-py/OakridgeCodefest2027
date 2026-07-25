import * as THREE from "three";

// Procedural shark

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

const BODY_VERT = `
  uniform float u_time;
  uniform float u_swimSpeed;
  uniform float u_swimAmount;
  uniform float u_headY;
  uniform float u_tailY;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 pos = position;
    float taper = clamp((u_headY - pos.y) / (u_headY - u_tailY), 0.0, 1.0);
    taper = taper * taper;
    float wiggle = sin(pos.y * 0.9 - u_time * u_swimSpeed) * u_swimAmount * taper;
    pos.x += wiggle;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STATIC_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

function makeMaterial(vertexShader: string, extraUniforms: Record<string, THREE.IUniform> = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: FRESNEL_FRAG,
    uniforms: {
      u_time: { value: 0 },
      u_baseColor: { value: new THREE.Color("#03211d") },
      u_glowColor: { value: new THREE.Color("#2ee6d6") },
      u_reveal: { value: 1 },
      ...extraUniforms,
    },
  });
}

function finShape(points: [number, number][]): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

const HEAD_Y = 2.85;
const TAIL_Y = -3.2;

export interface Shark {
  group: THREE.Group;
  bodyMaterial: THREE.ShaderMaterial;
  finMaterial: THREE.ShaderMaterial;
  tailFin: THREE.Mesh;
  update(elapsed: number): void;
}

export function createShark(): Shark {
  const group = new THREE.Group();
  const model = new THREE.Group();
  group.add(model);
  model.rotation.z = Math.PI / 2;

  // Body
  const profile = [
    new THREE.Vector2(0.0, TAIL_Y),
    new THREE.Vector2(0.14, -2.95),
    new THREE.Vector2(0.34, -2.3),
    new THREE.Vector2(0.52, -1.3),
    new THREE.Vector2(0.6, -0.3),
    new THREE.Vector2(0.56, 0.7),
    new THREE.Vector2(0.4, 1.7),
    new THREE.Vector2(0.2, 2.35),
    new THREE.Vector2(0.05, 2.72),
    new THREE.Vector2(0.0, HEAD_Y),
  ];
  const bodyGeometry = new THREE.LatheGeometry(profile, 20);
  const bodyMaterial = makeMaterial(BODY_VERT, {
    u_swimSpeed: { value: 2.1 },
    u_swimAmount: { value: 0.16 },
    u_headY: { value: HEAD_Y },
    u_tailY: { value: TAIL_Y },
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  model.add(body);

  const finMaterial = makeMaterial(STATIC_VERT);

  // Dorsal fin
  const dorsalShape = finShape([
    [0, 0],
    [0.05, 0.75],
    [0.55, 0.35],
    [0.5, 0],
  ]);
  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, { depth: 0.04, bevelEnabled: false });
  const dorsalFin = new THREE.Mesh(dorsalGeo, finMaterial);
  dorsalFin.position.set(-0.02, 0.3, 0);
  dorsalFin.rotation.y = Math.PI / 2;
  dorsalFin.rotation.z = -0.15;
  model.add(dorsalFin);

  // Pectoral fins
  const pecShape = finShape([
    [0, 0],
    [-0.15, -0.55],
    [0.55, -0.4],
    [0.45, 0],
  ]);
  const pecGeoL = new THREE.ExtrudeGeometry(pecShape, { depth: 0.04, bevelEnabled: false });
  const pecFinL = new THREE.Mesh(pecGeoL, finMaterial);
  pecFinL.position.set(0.5, -0.5, 0);
  pecFinL.rotation.y = 0.5;
  pecFinL.rotation.z = 0.35;
  model.add(pecFinL);

  const pecFinR = pecFinL.clone();
  pecFinR.position.x = -0.5;
  pecFinR.rotation.y = Math.PI - 0.5;
  pecFinR.rotation.z = 0.35;
  model.add(pecFinR);

  // Tail fin
  const tailShape = finShape([
    [0, 0],
    [0.75, 0.55],
    [0.15, 0.05],
    [0.7, -0.6],
  ]);
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.04, bevelEnabled: false });
  const tailFin = new THREE.Mesh(tailGeo, finMaterial);
  tailFin.position.set(-0.08, 0, 0);
  tailFin.rotation.y = Math.PI / 2;
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, TAIL_Y - 0.1, 0);
  tailPivot.add(tailFin);
  model.add(tailPivot);

  function update(elapsed: number) {
    bodyMaterial.uniforms.u_time.value = elapsed;
    finMaterial.uniforms.u_time.value = elapsed;
    tailPivot.rotation.y = Math.sin(elapsed * 2.1) * 0.35;
  }

  return { group, bodyMaterial, finMaterial, tailFin, update };
}
