import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

export interface InteractionPrompt {
  icon: string;
  title: string;
  hint: string;
  kind: 'npc' | 'monster' | 'chest' | 'exit';
}

export interface EngineCallbacks {
  onPrompt?: (prompt: InteractionPrompt | null) => void;
  onNotice?: (msg: string) => void;
}

type ObjectKind = 'npc' | 'monster' | 'chest' | 'exit';

interface WorldObject {
  group: THREE.Group;
  kind: ObjectKind;
  r: number;
  c: number;
  baseY: number;
  claimed?: boolean;
  name?: string;
  hp?: number;
}

const TILE = 1; // one world unit per grid tile

const CLASS_COLORS: Record<string, number> = {
  Warrior: 0xc0392b,
  Mage: 0x2b6ede,
  Ranger: 0x27ae60,
};

/**
 * A real-time 3D dungeon renderer built on Three.js. It reads the same ASCII
 * region grid the game already uses and turns it into a lit, navigable 3D scene
 * with a following camera, a torch-lit hero, and clearly labelled interactive
 * objects (NPCs, monsters, loot chests, and region exits).
 */
export class ThreeGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private rafId = 0;
  private resizeObserver?: ResizeObserver;

  private mapGrid: string[][] = [];
  private objects: WorldObject[] = [];
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
  private facing = new THREE.Vector3(0, 0, -1);

  private keys: Record<string, boolean> = {};
  private lastPromptKind: string | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    this.loadMap();

    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Scene + atmospheric fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06070a);
    this.scene.fog = new THREE.Fog(0x06070a, 8, 26);

    // Camera
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 100);
    this.camera.position.set(0, 10, 10);

    this.buildLights();
    this.buildMap();

    // Input
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Responsive
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    // Snap camera behind the player immediately.
    this.updateCamera(1);

    this.animate();
  }

  private loadMap() {
    const state = useGameStore.getState();
    const regionName = state.character?.current_region || 'Eldergate';
    const region = state.regions.find((r) => r.name === regionName);

    const ascii = region?.terrain_ascii ||
      '##########\n#S...T...#\n#..####..#\n#..#..#..#\n#..M..E..#\n##########';
    this.mapGrid = ascii.split('\n').map((row) => row.split(''));
  }

  private buildLights() {
    // Soft cold ambient (moonlit dungeon).
    this.scene.add(new THREE.AmbientLight(0x5566aa, 0.55));

    // Directional moonlight that casts shadows.
    const moon = new THREE.DirectionalLight(0x93a7ff, 0.7);
    moon.position.set(8, 16, 6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 60;
    const d = 20;
    moon.shadow.camera.left = -d;
    moon.shadow.camera.right = d;
    moon.shadow.camera.top = d;
    moon.shadow.camera.bottom = -d;
    this.scene.add(moon);

    // Warm hero torch that follows the player.
    this.torch = new THREE.PointLight(0xffb060, 2.4, 9, 2);
    this.torch.position.set(0, 2.2, 0);
    this.scene.add(this.torch);
  }

  private buildMap() {
    const rows = this.mapGrid.length;

    // Shared geometries/materials for performance.
    const floorGeo = new THREE.BoxGeometry(TILE * 0.98, 0.2, TILE * 0.98);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x20222e, roughness: 0.95, metalness: 0.05 });
    const floorMatAlt = new THREE.MeshStandardMaterial({ color: 0x191b25, roughness: 0.95, metalness: 0.05 });
    const wallGeo = new THREE.BoxGeometry(TILE, 2.3, TILE);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e0f16, roughness: 0.8, metalness: 0.15, emissive: 0x1a1408, emissiveIntensity: 0.25 });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < this.mapGrid[r].length; c++) {
        const char = this.mapGrid[r][c];
        const { x, z } = this.gridToWorld(r, c);

        if (char === '#') {
          const wall = new THREE.Mesh(wallGeo, wallMat);
          wall.position.set(x, 1.05, z);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.scene.add(wall);
          continue;
        }

        // Every non-wall tile gets a floor pad.
        const checker = (r + c) % 2 === 0;
        const floor = new THREE.Mesh(floorGeo, checker ? floorMat : floorMatAlt);
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
        }
      }
    }
  }

  private gridToWorld(r: number, c: number) {
    return { x: c * TILE, z: r * TILE };
  }

  // ---- Player ----

  private spawnPlayer(r: number, c: number) {
    this.pr = r;
    this.pc = c;

    const state = useGameStore.getState();
    const charClass = state.character?.character_class || 'Warrior';
    const color = CLASS_COLORS[charClass] ?? 0xc0392b;

    const group = new THREE.Group();

    // Glowing base ring so the player is always easy to spot.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xe2b653, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    // Body.
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.26, 0.5, 6, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, emissive: color, emissiveIntensity: 0.15 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Head.
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1d3a7, roughness: 0.6 })
    );
    head.position.y = 1.22;
    head.castShadow = true;
    group.add(head);

    // A small forward "nose" cone so facing direction reads clearly.
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2b653, emissive: 0xe2b653, emissiveIntensity: 0.4 })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.22, -0.22);
    group.add(nose);

    const { x, z } = this.gridToWorld(r, c);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.player = group;
  }

  // ---- Interactive objects ----

  private addNpc(r: number, c: number) {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshStandardMaterial({ color: 0x2b6ede, emissive: 0x2b6ede, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.4 })
    );
    crystal.position.y = 0.9;
    crystal.castShadow = true;
    group.add(crystal);

    const glow = new THREE.PointLight(0x2b6ede, 1.2, 4, 2);
    glow.position.y = 0.9;
    group.add(glow);

    group.add(this.makeBaseGlow(0x2b6ede));
    group.add(this.makeLabel('💬  TALK', '#2b6ede', 1.9));

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
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: 0x7a1414, emissive: 0xb51d1d, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.3 })
    );
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    // Spiky eyes.
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcc55, emissiveIntensity: 1 });
    for (const dx of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
      eye.position.set(dx, 0.9, 0.34);
      group.add(eye);
    }

    group.add(this.makeBaseGlow(0xb51d1d));
    group.add(this.makeLabel('⚔️  FIGHT', '#c0392b', 1.85));

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
      new THREE.MeshStandardMaterial({ color: 0xe2b653, roughness: 0.35, metalness: 0.7, emissive: 0xe2b653, emissiveIntensity: 0.35 })
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
      new THREE.TorusGeometry(0.42, 0.1, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0x9b59b6, emissive: 0x8e44ff, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.5 })
    );
    portal.position.y = 0.9;
    group.add(portal);

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 32),
      new THREE.MeshBasicMaterial({ color: 0x2a1040, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    core.position.y = 0.9;
    group.add(core);

    const glow = new THREE.PointLight(0x8e44ff, 1.4, 5, 2);
    glow.position.y = 0.9;
    group.add(glow);

    group.add(this.makeBaseGlow(0x8e44ff));
    group.add(this.makeLabel('🚪  EXIT REGION', '#a569d6', 1.9));

    this.placeObject(group, r, c, 'exit');
  }

  private placeObject(group: THREE.Group, r: number, c: number, kind: ObjectKind, name?: string, hp?: number) {
    const { x, z } = this.gridToWorld(r, c);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.objects.push({ group, kind, r, c, baseY: 0, name, hp, claimed: false });
  }

  private makeBaseGlow(color: number) {
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
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

  // ---- Input & movement ----

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    this.keys[k] = true;
    // Edge-trigger a step immediately so quick taps are never missed by the
    // per-frame poll (which also keeps held keys moving continuously).
    this.pump();
  };

  private pump() {
    if (this.moving || !this.player) return;
    // Freeze exploration movement while a combat encounter is active.
    if (useGameStore.getState().enemyHp > 0) return;
    const { dr, dc } = this.readInput();
    if (dr !== 0 || dc !== 0) this.tryMove(dr, dc);
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

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
    if (dr !== 0 || dc !== 0) {
      this.facing.set(dc, 0, dr).normalize();
      this.player.rotation.y = Math.atan2(dc, dr);
    }
  }

  private finishMove() {
    this.pr = this.moveTargetR;
    this.pc = this.moveTargetC;
    this.player.position.copy(this.moveTo);
    this.moving = false;
    this.checkTriggers();
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

  // ---- Particles ----

  private spawnParticles(pos: THREE.Vector3, color: number) {
    for (let i = 0; i < 18; i++) {
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
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life);
      (p.mesh.material as THREE.MeshBasicMaterial).transparent = true;
      p.mesh.scale.setScalar(Math.max(0.01, p.life));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // ---- Camera ----

  private updateCamera(lerp: number) {
    if (!this.player) return;
    // Third-person: sit behind (+z) and above the hero, looking down at them.
    const desired = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + 7.5,
      this.player.position.z + 8.5
    );
    this.camera.position.lerp(desired, lerp);

    const look = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + 0.8,
      this.player.position.z
    );
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
          // little hop
          this.player.position.y = Math.sin(this.moveT * Math.PI) * 0.18;
        }
      } else {
        this.pump();
        // idle bob
        this.player.position.y = Math.sin(t * 2) * 0.03;
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
        o.group.position.y = Math.abs(Math.sin(t * 4 + o.r)) * 0.12;
      } else if (o.kind === 'npc') {
        mesh.rotation.y += dt * 1.5;
        o.group.position.y = Math.sin(t * 2 + o.c) * 0.1 + 0.05;
      } else if (o.kind === 'exit') {
        mesh.rotation.z += dt * 1.5;
        o.group.rotation.y += dt * 0.6;
      }
    }

    this.updateParticles(dt);
    this.updateCamera(this.moving ? 0.12 : 0.08);
    this.torch.intensity = 2.2 + Math.sin(t * 9) * 0.25; // flicker

    this.renderer.render(this.scene, this.camera);
  };

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.resizeObserver?.disconnect();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry?.dispose?.();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
