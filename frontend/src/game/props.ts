/**
 * Low-poly, fully procedural environment props for the 3D world. Every builder
 * returns a `THREE.Group` positioned at local origin (its base sitting on y=0)
 * so the engine can drop it straight onto a tile.
 *
 * A tiny seeded PRNG keeps scatter layouts stable between renders of the same
 * region (so the world does not "shuffle" every frame / remount).
 */
import * as THREE from 'three';
import type { RegionTheme, BarrierKind, ScatterKind } from './regionThemes';

/** Deterministic hash -> [0,1) generator seeded from grid coordinates. */
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cellSeed(r: number, c: number) {
  return (r * 73856093) ^ (c * 19349663);
}

function std(color: number, roughness = 0.9, metalness = 0.0, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, flatShading: true });
}

/* ------------------------------------------------------------------ barriers */

/** A rounded low-poly conifer/oak with a couple of foliage tiers. */
function makeTree(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.4 + rng() * 0.9;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, h * 0.5, 6),
    std(0x4a331d, 0.95)
  );
  trunk.position.y = h * 0.25;
  trunk.castShadow = true;
  g.add(trunk);

  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.7 - t * 0.35, 0.85, 7),
      std(i % 2 ? theme.foliageAlt : theme.foliage, 0.85)
    );
    cone.position.y = h * 0.5 + i * 0.42;
    cone.rotation.y = rng() * Math.PI;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

/** Bare, gnarled swamp tree with glowing spore tips. */
function makeDeadTree(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.8 + rng() * 0.8;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.22, h, 6),
    std(theme.barrierColor, 0.95)
  );
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);

  const branches = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < branches; i++) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.06, 0.6 + rng() * 0.4, 5),
      std(theme.barrierColor, 0.95)
    );
    b.position.y = h * (0.55 + rng() * 0.4);
    b.rotation.z = (rng() - 0.5) * 1.6;
    b.rotation.y = rng() * Math.PI * 2;
    b.position.x = (rng() - 0.5) * 0.4;
    g.add(b);

    const spore = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      std(theme.foliage, 0.4, 0.2, theme.accent, 1.4)
    );
    spore.position.set(b.position.x + (rng() - 0.5) * 0.4, b.position.y + 0.25, (rng() - 0.5) * 0.4);
    g.add(spore);
  }
  return g;
}

/** Jagged ice crystal cluster. */
function makeIce(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const shards = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < shards; i++) {
    const hh = 1.0 + rng() * 1.4;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.18 + rng() * 0.14, hh, 5),
      new THREE.MeshStandardMaterial({
        color: theme.barrierColor,
        roughness: 0.15,
        metalness: 0.1,
        emissive: theme.accent,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.85,
        flatShading: true,
      })
    );
    shard.position.set((rng() - 0.5) * 0.5, hh / 2, (rng() - 0.5) * 0.5);
    shard.rotation.z = (rng() - 0.5) * 0.4;
    shard.castShadow = true;
    g.add(shard);
  }
  return g;
}

/** Weathered sandstone mesa/boulder stack. */
function makeMesa(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const blocks = 2 + Math.floor(rng() * 2);
  let y = 0;
  for (let i = 0; i < blocks; i++) {
    const w = 1.0 - i * 0.22 + rng() * 0.1;
    const hh = 0.6 + rng() * 0.4;
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(w, hh, w),
      std(i % 2 ? theme.barrierColor : theme.foliageAlt, 0.95)
    );
    rock.position.set((rng() - 0.5) * 0.15, y + hh / 2, (rng() - 0.5) * 0.15);
    rock.rotation.y = rng() * 0.4;
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
    y += hh;
  }
  return g;
}

export function makeBarrier(kind: BarrierKind, theme: RegionTheme, seed: number): THREE.Group {
  const rng = seededRandom(seed);
  let g: THREE.Group;
  switch (kind) {
    case 'tree': g = makeTree(theme, rng); break;
    case 'deadtree': g = makeDeadTree(theme, rng); break;
    case 'ice': g = makeIce(theme, rng); break;
    case 'mesa': g = makeMesa(theme, rng); break;
  }
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}

/* ------------------------------------------------------------------- scatter */

function makeGrass(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const blades = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < blades; i++) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.28 + rng() * 0.18, 4),
      std(rng() > 0.5 ? theme.foliage : theme.foliageAlt, 0.9)
    );
    blade.position.set((rng() - 0.5) * 0.5, 0.15, (rng() - 0.5) * 0.5);
    blade.rotation.z = (rng() - 0.5) * 0.3;
    g.add(blade);
  }
  return g;
}

function makeReed(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const stalks = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < stalks; i++) {
    const h = 0.5 + rng() * 0.5;
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, h, 4),
      std(theme.foliageAlt, 0.9)
    );
    stalk.position.set((rng() - 0.5) * 0.4, h / 2, (rng() - 0.5) * 0.4);
    stalk.rotation.z = (rng() - 0.5) * 0.25;
    g.add(stalk);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      std(theme.foliage, 0.4, 0.2, theme.accent, 0.9)
    );
    tip.position.set(stalk.position.x, h, stalk.position.z);
    g.add(tip);
  }
  return g;
}

function makeShard(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const n = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const h = 0.25 + rng() * 0.4;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, h, 4),
      new THREE.MeshStandardMaterial({
        color: theme.foliage,
        roughness: 0.15,
        metalness: 0.1,
        emissive: theme.accent,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.9,
        flatShading: true,
      })
    );
    shard.position.set((rng() - 0.5) * 0.4, h / 2, (rng() - 0.5) * 0.4);
    shard.rotation.z = (rng() - 0.5) * 0.3;
    g.add(shard);
  }
  return g;
}

function makeStone(theme: RegionTheme, rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.1 + rng() * 0.18;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std(theme.barrierColor, 0.95));
    rock.position.set((rng() - 0.5) * 0.5, s * 0.6, (rng() - 0.5) * 0.5);
    rock.rotation.set(rng(), rng(), rng());
    rock.castShadow = true;
    g.add(rock);
  }
  return g;
}

export function makeScatter(kind: ScatterKind, theme: RegionTheme, seed: number): THREE.Group {
  const rng = seededRandom(seed);
  switch (kind) {
    case 'grass': return makeGrass(theme, rng);
    case 'reed': return makeReed(theme, rng);
    case 'shard': return makeShard(theme, rng);
    case 'stone': return makeStone(theme, rng);
  }
}

/* --------------------------------------------------------------------- torch */

export interface WallTorch {
  group: THREE.Group;
  light: THREE.PointLight;
  flame: THREE.Mesh;
}

/** A bracket torch with a flickering flame and its own point light. */
export function makeWallTorch(theme: RegionTheme): WallTorch {
  const group = new THREE.Group();

  const bracket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5),
    std(0x2a2a2a, 0.9, 0.4)
  );
  bracket.position.y = 0.25;
  group.add(bracket);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.32, 8),
    new THREE.MeshBasicMaterial({ color: theme.torch, transparent: true, opacity: 0.95 })
  );
  flame.position.y = 0.62;
  group.add(flame);

  const light = new THREE.PointLight(theme.torch, 2.2, 6, 2);
  light.position.y = 0.7;
  group.add(light);

  return { group, light, flame };
}

/** A cracked ruined pillar, useful as a landmark near exits/NPCs. */
export function makePillar(theme: RegionTheme, seed: number): THREE.Group {
  const rng = seededRandom(seed);
  const g = new THREE.Group();
  const h = 1.6 + rng() * 0.8;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, h, 10),
    std(0x8a8172, 0.9)
  );
  shaft.position.y = h / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), std(0x9a9184, 0.9));
  cap.position.y = h + 0.09;
  g.add(cap);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.75), std(0x7a7266, 0.9));
  base.position.y = 0.1;
  g.add(base);

  // Faint biome-tinted moss creeping up the shaft.
  const moss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, h * 0.35, 10, 1, true),
    std(theme.foliageAlt, 0.95, 0.0, theme.accent, 0.15)
  );
  moss.position.y = h * 0.2;
  g.add(moss);
  return g;
}
