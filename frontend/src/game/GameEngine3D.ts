import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

import { useGameStore } from '../store/gameStore';
import { getRegionTheme, RegionTheme } from './regionThemes';
import {
  makeBarrier,
  makeScatter,
  makeWallTorch,
  makePillar,
  cellSeed,
  seededRandom,
} from './props';

export interface InteractionPrompt {
  icon: string;
  title: string;
  hint: string;
  kind: 'npc' | 'monster' | 'chest' | 'exit';
}

export type ObjectKind = 'npc' | 'monster' | 'chest' | 'exit';

export interface MinimapObject {
  r: number;
  c: number;
  kind: ObjectKind;
  claimed: boolean;
}

export interface MinimapData {
  grid: string[][];
  player: { r: number; c: number };
  objects: MinimapObject[];
}

export interface EngineCallbacks {
  onPrompt?: (prompt: InteractionPrompt | null) => void;
  onNotice?: (msg: string) => void;
  onMinimap?: (data: MinimapData) => void;
}

interface WorldObject {
  group: THREE.Group;
  kind: ObjectKind;
  r: number;
  c: number;
  claimed?: boolean;
  name?: string;
  hp?: number;
}

interface TorchLight {
  light: THREE.PointLight;
  flame: THREE.Mesh;
  phase: number;
  base: number;
}

const TILE = 1; // one world unit per grid tile

const CLASS_COLORS: Record<string, number> = {
  Warrior: 0xc0392b,
  Mage: 0x2b6ede,
  Ranger: 0x27ae60,
};

/**
 * A real-time 3D ARPG renderer built on Three.js. It reads the same ASCII
 * region grid the game already uses and turns it into a lit, atmospheric,
 * region-themed world: themed ground and sky, decorative props, torch-lit
 * paths, a class-specific hero, animated enemies, bloom post-processing and a
 * smooth following camera with zoom/orbit.
 */
export class ThreeGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private theme: RegionTheme;

  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private fxaaPass!: ShaderPass;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private rafId = 0;
  private resizeObserver?: ResizeObserver;

  private mapGrid: string[][] = [];
  private center = new THREE.Vector3();
  private objects: WorldObject[] = [];
  private torches: TorchLight[] = [];
  private sky?: THREE.Mesh;
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

  private player!: THREE.Group;
  private torch!: THREE.PointLight;

  // Grid position of the player.
  private pr = 0;
  private pc = 0;

  // Smooth movement state.
  private moving = false;
  private moveT = 0;
  private moveFrom = new THREE.Vector3();
  private moveTo = new THREE.Vector3();
  private moveTargetR = 0;
  private moveTargetC = 0;

  // Camera framing.
  private zoom = 1;
  private azimuth = 0;
  private dragging = false;
  private lastPointerX = 0;

  private keys: Record<string, boolean> = {};
  private lastPromptKind: string | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    const state = useGameStore.getState();
    const regionName = state.character?.current_region || 'Eldergate';
    const region = state.regions.find((r) => r.name === regionName);
    this.theme = getRegionTheme(regionName, region?.difficulty_level ?? 1);

    this.init();
  }

  private init() {
    this.loadMap();

    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    // Renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Scene + atmospheric fog matched to the biome horizon.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.background);
    this.scene.fog = new THREE.Fog(this.theme.fog.color, this.theme.fog.near, this.theme.fog.far);

    // Camera.
    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);

    this.buildLights();
    this.buildEnvironment();
    this.buildMap();
    this.setupComposer(w, h);

    // Input.
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);

    // Responsive.
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    // Snap camera behind the hero immediately, then emit the first minimap.
    this.updateCamera(1);
    this.emitMinimap();

    this.animate();
  }

  private loadMap() {
    const state = useGameStore.getState();
    const regionName = state.character?.current_region || 'Eldergate';
    const region = state.regions.find((r) => r.name === regionName);

    const ascii =
      region?.terrain_ascii ||
      '############\n#S....T....#\n#..####....#\n#..#..#..M.#\n#..M..G....#\n#..........#\n#..M.......#\n#.......G..#\n#..........#\n#....M.....#\n#.........E#\n############';
    this.mapGrid = ascii.split('\n').map((row) => row.split(''));

    const rows = this.mapGrid.length;
    const cols = this.mapGrid[0]?.length || 1;
    this.center.set(((cols - 1) * TILE) / 2, 0, ((rows - 1) * TILE) / 2);
  }

  // ---- Lighting & environment ----

  private buildLights() {
    const t = this.theme;

    this.scene.add(new THREE.AmbientLight(t.ambient.color, t.ambient.intensity));
    this.scene.add(new THREE.HemisphereLight(t.hemisphere.sky, t.hemisphere.ground, t.hemisphere.intensity));

    const sun = new THREE.DirectionalLight(t.sun.color, t.sun.intensity);
    sun.position.set(this.center.x + t.sun.position[0], t.sun.position[1], this.center.z + t.sun.position[2]);
    sun.target.position.copy(this.center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    const d = 18;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);

    // Warm hero torch that follows the player.
    this.torch = new THREE.PointLight(t.torch, 2.4, 10, 2);
    this.torch.position.copy(this.center).setY(2.2);
    this.scene.add(this.torch);
  }

  private buildEnvironment() {
    const t = this.theme;

    // Gradient sky dome (unaffected by fog so it reads as a real horizon).
    const skyGeo = new THREE.SphereGeometry(90, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(t.skyTop) },
        bottom: { value: new THREE.Color(t.skyBottom) },
        exponent: { value: 0.7 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform float exponent;
        varying vec3 vWorld;
        void main() {
          float hgt = normalize(vWorld).y;
          float f = pow(max(hgt, 0.0), exponent);
          gl_FragColor = vec4(mix(bottom, top, f), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.position.copy(this.center);
    this.scene.add(this.sky);

    if (t.stars) this.buildStars();

    // Large ground plane so the world never fades into a void.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: t.ground.color, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(this.center.x, -0.18, this.center.z);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildStars() {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 70;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random()); // upper hemisphere
      positions[i * 3] = this.center.x + radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.9 + 6;
      positions[i * 3 + 2] = this.center.z + radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xcfd6ff, size: 0.35, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.9 });
    this.scene.add(new THREE.Points(geo, mat));
  }

  // ---- Map ----

  private buildMap() {
    const rows = this.mapGrid.length;

    const floorGeo = new THREE.BoxGeometry(TILE * 0.98, 0.2, TILE * 0.98);
    const floorMatA = new THREE.MeshStandardMaterial({ color: this.theme.floor.colorA, roughness: this.theme.floor.roughness, metalness: this.theme.floor.metalness });
    const floorMatB = new THREE.MeshStandardMaterial({ color: this.theme.floor.colorB, roughness: this.theme.floor.roughness, metalness: this.theme.floor.metalness });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < this.mapGrid[r].length; c++) {
        const char = this.mapGrid[r][c];
        const { x, z } = this.gridToWorld(r, c);
        const seed = cellSeed(r, c);

        if (char === '#') {
          const barrier = makeBarrier(this.theme.barrier, this.theme, seed);
          barrier.position.set(x, 0, z);
          this.scene.add(barrier);
          this.maybeAddTorch(r, c, x, z, seed);
          continue;
        }

        // Walkable tile pad (checkerboarded).
        const checker = (r + c) % 2 === 0;
        const floor = new THREE.Mesh(floorGeo, checker ? floorMatA : floorMatB);
        floor.position.set(x, -0.1, z);
        floor.receiveShadow = true;
        this.scene.add(floor);

        switch (char) {
          case 'S':
            this.spawnPlayer(r, c);
            break;
          case 'T':
            this.addNpc(r, c);
            break;
          case 'M':
            this.addMonster(r, c);
            break;
          case 'G':
            this.addChest(r, c);
            break;
          case 'E':
            this.addExit(r, c);
            break;
          case '.':
            this.maybeScatter(x, z, seed);
            break;
        }
      }
    }
  }

  private gridToWorld(r: number, c: number) {
    return { x: c * TILE, z: r * TILE };
  }

  private isOpen(r: number, c: number) {
    if (r < 0 || r >= this.mapGrid.length || c < 0 || c >= this.mapGrid[0].length) return false;
    return this.mapGrid[r][c] !== '#';
  }

  private maybeScatter(x: number, z: number, seed: number) {
    const rng = seededRandom(seed ^ 0x9e3779b9);
    if (rng() > this.theme.scatterDensity) return;
    const prop = makeScatter(this.theme.scatter, this.theme, seed);
    prop.position.set(x + (rng() - 0.5) * 0.4, 0, z + (rng() - 0.5) * 0.4);
    this.scene.add(prop);
  }

  /** Mount a wall torch on a barrier tile that faces an open path. */
  private maybeAddTorch(r: number, c: number, x: number, z: number, seed: number) {
    const rng = seededRandom(seed ^ 0x51ed270b);
    if (rng() > 0.16) return;

    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ].filter((d) => this.isOpen(r + d.dr, c + d.dc));
    if (dirs.length === 0) return;

    const dir = dirs[Math.floor(rng() * dirs.length)];
    const torch = makeWallTorch(this.theme);
    torch.group.position.set(x + dir.dc * 0.45, 1.0, z + dir.dr * 0.45);
    this.scene.add(torch.group);
    this.torches.push({ light: torch.light, flame: torch.flame, phase: rng() * Math.PI * 2, base: 2.2 });
  }

  // ---- Hero ----

  private spawnPlayer(r: number, c: number) {
    this.pr = r;
    this.pc = c;

    const state = useGameStore.getState();
    const charClass = state.character?.character_class || 'Warrior';
    const color = CLASS_COLORS[charClass] ?? 0xc0392b;

    const group = this.buildHero(charClass, color);

    const { x, z } = this.gridToWorld(r, c);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.player = group;
  }

  private buildHero(charClass: string, color: number): THREE.Group {
    const group = new THREE.Group();

    // Glowing selection ring so the hero always reads clearly.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.52, 32),
      new THREE.MeshBasicMaterial({ color: 0xe2b653, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    const skin = new THREE.MeshStandardMaterial({ color: 0xf1d3a7, roughness: 0.6 });
    const armor = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.35, emissive: color, emissiveIntensity: 0.12 });

    // Torso.
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 6, 12), armor);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Head.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), skin);
    head.position.y = 1.24;
    head.castShadow = true;
    group.add(head);

    if (charClass === 'Warrior') {
      // Pauldrons.
      for (const dx of [-0.3, 0.3]) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), armor);
        pad.position.set(dx, 0.98, 0);
        group.add(pad);
      }
      // Sword held to the right.
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.8, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.25, metalness: 0.9, emissive: 0x556070, emissiveIntensity: 0.3 })
      );
      blade.position.y = 0.4;
      sword.add(blade);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0xe2b653, metalness: 0.8, roughness: 0.3 }));
      sword.add(guard);
      sword.position.set(0.36, 0.5, 0.1);
      sword.rotation.z = 0.15;
      sword.castShadow = true;
      group.add(sword);
    } else if (charClass === 'Mage') {
      // Robe skirt.
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.7, 12), armor);
      robe.position.y = 0.35;
      robe.castShadow = true;
      group.add(robe);
      // Pointed hat.
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      hat.position.y = 1.5;
      group.add(hat);
      // Staff with a glowing orb (blooms).
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 }));
      staff.position.set(0.34, 0.55, 0.05);
      group.add(staff);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshStandardMaterial({ color: this.theme.accent, emissive: this.theme.accent, emissiveIntensity: 1.6, roughness: 0.2 })
      );
      orb.position.set(0.34, 1.15, 0.05);
      group.add(orb);
    } else {
      // Ranger: hood + bow.
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 12), armor);
      hood.position.y = 1.42;
      group.add(hood);
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.03, 8, 24, Math.PI * 1.2),
        new THREE.MeshStandardMaterial({ color: 0x6b4a1c, roughness: 0.7, metalness: 0.2 })
      );
      bow.position.set(0.34, 0.7, 0.05);
      bow.rotation.y = Math.PI / 2;
      group.add(bow);
    }

    return group;
  }

  // ---- Interactive objects ----

  private addNpc(r: number, c: number) {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x3f8bff, emissive: 0x2b6ede, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.4 })
    );
    crystal.position.y = 1.0;
    crystal.castShadow = true;
    group.add(crystal);

    const glow = new THREE.PointLight(0x2b6ede, 1.4, 5, 2);
    glow.position.y = 1.0;
    group.add(glow);

    // A little shrine pillar under the crystal as a landmark.
    const pillar = makePillar(this.theme, cellSeed(r, c) ^ 0x2545f491);
    pillar.scale.setScalar(0.5);
    group.add(pillar);

    group.add(this.makeBaseGlow(0x2b6ede));
    group.add(this.makeLabel('💬  TALK', '#3f8bff', 2.0));

    this.placeObject(group, r, c, 'npc');
  }

  private addMonster(r: number, c: number) {
    const state = useGameStore.getState();
    const regionLvl = state.regions.find((reg) => reg.name === state.character?.current_region)?.difficulty_level || 1;
    const names = ['Fallen Ghoul', 'Void Specter', 'Frost Golem', 'Ember Drake'];
    const name = names[regionLvl - 1] || 'Ruins Crawler';
    const hp = 40 + regionLvl * 30;

    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.44, 0),
      new THREE.MeshStandardMaterial({ color: 0x7a1414, emissive: 0xb51d1d, emissiveIntensity: 0.7, roughness: 0.45, metalness: 0.3, flatShading: true })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Horns.
    for (const dx of [-0.2, 0.2]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.34, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a0d0d, roughness: 0.6 })
      );
      horn.position.set(dx, 1.28, 0.05);
      horn.rotation.z = dx > 0 ? -0.4 : 0.4;
      group.add(horn);
    }

    // Glowing eyes.
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcc55, emissiveIntensity: 1.4 });
    for (const dx of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
      eye.position.set(dx, 0.96, 0.36);
      group.add(eye);
    }

    group.add(this.makeBaseGlow(0xb51d1d));
    group.add(this.makeLabel('⚔️  FIGHT', '#e0574a', 1.95));

    this.placeObject(group, r, c, 'monster', name, hp);
  }

  private addChest(r: number, c: number) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.32, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x6b4a1c, roughness: 0.6, metalness: 0.4, emissive: 0x2a1d08, emissiveIntensity: 0.3 })
    );
    base.position.y = 0.36;
    base.castShadow = true;
    group.add(base);

    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.38),
      new THREE.MeshStandardMaterial({ color: 0xe2b653, roughness: 0.3, metalness: 0.8, emissive: 0xe2b653, emissiveIntensity: 0.5 })
    );
    lid.position.y = 0.58;
    lid.castShadow = true;
    group.add(lid);

    group.add(this.makeBaseGlow(0xe2b653));
    group.add(this.makeLabel('🪙  LOOT', '#e2b653', 1.5));

    this.placeObject(group, r, c, 'chest');
  }

  private addExit(r: number, c: number) {
    const group = new THREE.Group();
    const portal = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.1, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xb07bff, emissive: 0x8e44ff, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.5 })
    );
    portal.position.y = 1.0;
    group.add(portal);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 32),
      new THREE.MeshBasicMaterial({ color: 0x2a1040, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    core.position.y = 1.0;
    group.add(core);

    const glow = new THREE.PointLight(0x8e44ff, 1.6, 6, 2);
    glow.position.y = 1.0;
    group.add(glow);

    group.add(this.makeBaseGlow(0x8e44ff));
    group.add(this.makeLabel('🚪  EXIT REGION', '#b07bff', 2.0));

    this.placeObject(group, r, c, 'exit');
  }

  private placeObject(group: THREE.Group, r: number, c: number, kind: ObjectKind, name?: string, hp?: number) {
    const { x, z } = this.gridToWorld(r, c);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.objects.push({ group, kind, r, c, name, hp, claimed: false });
  }

  private makeBaseGlow(color: number) {
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    return ring;
  }

  /** Builds a canvas-textured sprite that always faces the camera. */
  private makeLabel(text: string, color: string, y: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(6, 7, 10, 0.82)';
    this.roundRect(ctx, 6, 30, 500, 68, 20);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    this.roundRect(ctx, 6, 30, 500, 68, 20);
    ctx.stroke();

    ctx.font = 'bold 46px Outfit, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 256, 66);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(1.7, 0.42, 1);
    sprite.position.y = y;
    sprite.renderOrder = 999;
    return sprite;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Post-processing ----

  private setupComposer(w: number, h: number) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.55, 0.82);
    this.composer.addPass(this.bloomPass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    const pr = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
    this.composer.addPass(this.fxaaPass);

    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms['offset'].value = 1.05;
    vignette.uniforms['darkness'].value = 1.25;
    this.composer.addPass(vignette);

    this.composer.addPass(new OutputPass());
  }

  // ---- Input & movement ----

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    this.keys[k] = true;
    this.pump();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom = THREE.MathUtils.clamp(this.zoom + (e.deltaY > 0 ? 0.1 : -0.1), 0.65, 1.8);
  };

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastPointerX = e.clientX;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.azimuth += dx * 0.005;
  };

  private onPointerUp = () => {
    this.dragging = false;
  };

  private pump() {
    if (this.moving || !this.player) return;
    // Freeze exploration movement while a combat encounter is active.
    if (useGameStore.getState().enemyHp > 0) return;
    const { dr, dc } = this.readInput();
    if (dr !== 0 || dc !== 0) this.tryMove(dr, dc);
  }

  private readInput(): { dr: number; dc: number } {
    if (this.keys['w'] || this.keys['arrowup']) return { dr: -1, dc: 0 };
    if (this.keys['s'] || this.keys['arrowdown']) return { dr: 1, dc: 0 };
    if (this.keys['a'] || this.keys['arrowleft']) return { dr: 0, dc: -1 };
    if (this.keys['d'] || this.keys['arrowright']) return { dr: 0, dc: 1 };
    return { dr: 0, dc: 0 };
  }

  private tryMove(dr: number, dc: number) {
    const tr = this.pr + dr;
    const tc = this.pc + dc;

    if (tr < 0 || tr >= this.mapGrid.length || tc < 0 || tc >= this.mapGrid[0].length) return;
    if (this.mapGrid[tr][tc] === '#') return;

    this.moving = true;
    this.moveT = 0;
    this.moveTargetR = tr;
    this.moveTargetC = tc;
    this.moveFrom.copy(this.player.position);
    const { x, z } = this.gridToWorld(tr, tc);
    this.moveTo.set(x, 0, z);

    // Face the direction of travel.
    this.player.rotation.y = Math.atan2(dc, dr);
  }

  private finishMove() {
    this.pr = this.moveTargetR;
    this.pc = this.moveTargetC;
    this.player.position.copy(this.moveTo);
    this.moving = false;
    this.checkTriggers();
    this.emitMinimap();
  }

  private checkTriggers() {
    const r = this.pr;
    const c = this.pc;
    const char = this.mapGrid[r][c];
    const state = useGameStore.getState();

    // NPC portal.
    if (char === 'T') {
      const region = state.character?.current_region || 'Eldergate';
      const npc = state.npcs.find((n) => n.current_region === region);
      if (npc) {
        state.setActiveNpc(npc);
        this.notice('Speaking with ' + npc.name + '...');
      }
    } else {
      if (state.activeNpc) state.setActiveNpc(null);
    }

    // Monster combat.
    const monster = this.objects.find((o) => o.kind === 'monster' && o.r === r && o.c === c && !o.claimed);
    if (monster) {
      state.triggerCombat(monster.name || 'Monster', monster.hp || 60);
      state.setScreen('GAMEPLAY');
    }

    // Loot chest.
    const chest = this.objects.find((o) => o.kind === 'chest' && o.r === r && o.c === c && !o.claimed);
    if (chest) {
      chest.claimed = true;
      this.spawnParticles(chest.group.position, 0xe2b653);
      this.scene.remove(chest.group);
      if (state.character) {
        const gold = 25 + Math.floor(Math.random() * 25);
        state.character.gold += gold;
        state.dashboardLogs.push(`Discovered a secret loot chest in ${state.character.current_region}! Looted 🪙 ${gold} gold.`);
        this.notice(`Claimed loot chest! +${gold} gold`);
      }
    }

    // Region exit.
    if (char === 'E') {
      this.notice('Region cleared — returning to town.');
      setTimeout(() => state.setScreen('DASHBOARD'), 900);
    }

    this.updatePrompt();
  }

  /** Shows a contextual hint when the hero is next to something interactive. */
  private updatePrompt() {
    const neighbors = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    let found: InteractionPrompt | null = null;
    for (const n of neighbors) {
      const nr = this.pr + n.dr;
      const nc = this.pc + n.dc;
      if (nr < 0 || nr >= this.mapGrid.length || nc < 0 || nc >= this.mapGrid[0].length) continue;
      const ch = this.mapGrid[nr][nc];

      const nearbyObj = this.objects.find((o) => o.r === nr && o.c === nc && !o.claimed);
      if (ch === 'T') { found = { icon: '💬', title: 'NPC nearby', hint: 'Step onto the blue crystal to talk', kind: 'npc' }; break; }
      if (nearbyObj?.kind === 'monster') { found = { icon: '⚔️', title: `${nearbyObj.name} nearby`, hint: 'Step onto it to begin combat', kind: 'monster' }; break; }
      if (nearbyObj?.kind === 'chest') { found = { icon: '🪙', title: 'Loot chest nearby', hint: 'Step onto the chest to claim gold', kind: 'chest' }; break; }
      if (ch === 'E') { found = { icon: '🚪', title: 'Region exit nearby', hint: 'Step onto the portal to finish', kind: 'exit' }; break; }
    }

    const key = found ? found.kind + found.title : null;
    if (key !== this.lastPromptKind) {
      this.lastPromptKind = key;
      this.callbacks.onPrompt?.(found);
    }
  }

  private notice(msg: string) {
    this.callbacks.onNotice?.(msg);
  }

  private emitMinimap() {
    this.callbacks.onMinimap?.({
      grid: this.mapGrid,
      player: { r: this.pr, c: this.pc },
      objects: this.objects.map((o) => ({ r: o.r, c: o.c, kind: o.kind, claimed: !!o.claimed })),
    });
  }

  // ---- Particles ----

  private spawnParticles(pos: THREE.Vector3, color: number) {
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color })
      );
      mesh.position.set(pos.x, 0.6, pos.z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * speed, 2 + Math.random() * 2, Math.sin(angle) * speed),
        life: 1,
      });
      this.scene.add(mesh);
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 6 * dt; // gravity
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt * 1.4;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.life);
      mat.transparent = true;
      p.mesh.scale.setScalar(Math.max(0.01, p.life));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // ---- Camera ----

  private updateCamera(lerp: number) {
    if (!this.player) return;

    const offset = new THREE.Vector3(0, 7.5 * this.zoom, 8.5 * this.zoom);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.azimuth);

    const desired = new THREE.Vector3().copy(this.player.position).add(offset);
    this.camera.position.lerp(desired, lerp);

    const look = new THREE.Vector3(this.player.position.x, this.player.position.y + 0.8, this.player.position.z);
    this.camera.lookAt(look);
  }

  // ---- Loop ----

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.player) {
      if (this.moving) {
        this.moveT += dt / 0.16; // ~160ms per tile
        if (this.moveT >= 1) {
          this.finishMove();
        } else {
          const eased = this.moveT * this.moveT * (3 - 2 * this.moveT);
          this.player.position.lerpVectors(this.moveFrom, this.moveTo, eased);
          this.player.position.y = Math.sin(this.moveT * Math.PI) * 0.18; // hop
        }
      } else {
        this.pump();
        this.player.position.y = Math.sin(t * 2) * 0.03; // idle bob
      }

      this.torch.position.set(this.player.position.x, this.player.position.y + 2.2, this.player.position.z);
    }

    // Animate interactive objects.
    for (const o of this.objects) {
      if (o.claimed) continue;
      const mesh = o.group.children[0];
      if (o.kind === 'chest') {
        o.group.rotation.y += dt * 1.2;
        o.group.position.y = Math.sin(t * 3 + o.c) * 0.06;
      } else if (o.kind === 'monster') {
        mesh.rotation.y += dt * 0.8;
        o.group.position.y = Math.abs(Math.sin(t * 3 + o.r)) * 0.14;
        const s = 1 + Math.sin(t * 5 + o.c) * 0.05;
        mesh.scale.setScalar(s);
      } else if (o.kind === 'npc') {
        mesh.rotation.y += dt * 1.5;
        mesh.position.y = 1.0 + Math.sin(t * 2 + o.c) * 0.1;
      } else if (o.kind === 'exit') {
        mesh.rotation.z += dt * 1.5;
        o.group.rotation.y += dt * 0.6;
      }
    }

    // Flicker torches.
    for (const tl of this.torches) {
      const f = tl.base + Math.sin(t * 10 + tl.phase) * 0.35 + Math.sin(t * 23 + tl.phase) * 0.12;
      tl.light.intensity = f;
      tl.flame.scale.y = 1 + Math.sin(t * 14 + tl.phase) * 0.18;
    }

    this.updateParticles(dt);
    this.updateCamera(this.moving ? 0.14 : 0.09);
    this.torch.intensity = 2.4 + Math.sin(t * 9) * 0.25; // hero torch flicker

    this.composer.render();
  };

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.resizeObserver?.disconnect();

    this.scene.traverse((obj) => {
      const anyObj = obj as THREE.Mesh;
      if (anyObj.geometry) anyObj.geometry.dispose?.();
      const mat = (anyObj as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material | undefined)?.dispose?.();
    });

    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
