/**
 * Region theming for the 3D world. Each backend region (delivered as an ASCII
 * `terrain_ascii` grid) is rendered with its own palette, fog, lighting and set
 * of environmental props so every map reads as a distinct, atmospheric place.
 *
 * Everything here is pure data - the engine (`GameEngine3D.ts`) and the prop
 * builders (`props.ts`) consume these values. No external assets required.
 */

export type BarrierKind = 'tree' | 'deadtree' | 'ice' | 'mesa';
export type ScatterKind = 'grass' | 'reed' | 'shard' | 'stone';

export interface RegionTheme {
  key: string;

  /** Solid scene background colour (behind the sky dome). */
  background: number;

  /** Sky dome gradient (top -> horizon). */
  skyTop: number;
  skyBottom: number;
  /** Sprinkle stars across the dome (night regions). */
  stars: boolean;

  /** Distance fog matched to the horizon so the world melts into the sky. */
  fog: { color: number; near: number; far: number };

  /** Global fills. */
  ambient: { color: number; intensity: number };
  hemisphere: { sky: number; ground: number; intensity: number };
  /** Key light ("sun"/"moon") that casts the shadows. */
  sun: { color: number; intensity: number; position: [number, number, number] };

  /** Large ground plane that sits under the whole map. */
  ground: { color: number };

  /** Walkable tile pads (checkerboarded for readability). */
  floor: { colorA: number; colorB: number; roughness: number; metalness: number };

  /** Impassable `#` tiles are rendered as this themed barrier prop. */
  barrier: BarrierKind;
  /** Fallback stone block colour when a barrier needs a base. */
  barrierColor: number;

  /** Small decorative clutter scattered across open floor tiles. */
  scatter: ScatterKind;
  /** 0..1 chance a given open floor tile receives a scatter prop. */
  scatterDensity: number;

  /** Foliage / prop accent colours. */
  foliage: number;
  foliageAlt: number;

  /** Warm torch colour used for the hero light and wall torches. */
  torch: number;
  /** Accent used for magical glows (portals, crystals) in this biome. */
  accent: number;
}

const FOREST: RegionTheme = {
  key: 'forest',
  background: 0x0a1410,
  skyTop: 0x16324a,
  skyBottom: 0x3b5a44,
  stars: false,
  fog: { color: 0x24402f, near: 10, far: 34 },
  ambient: { color: 0x88a0b5, intensity: 0.75 },
  hemisphere: { sky: 0xbfe3ff, ground: 0x2f4d2a, intensity: 1.05 },
  sun: { color: 0xfff0c4, intensity: 1.6, position: [12, 18, 8] },
  ground: { color: 0x2c4a2a },
  floor: { colorA: 0x3d5c34, colorB: 0x33512e, roughness: 0.95, metalness: 0.0 },
  barrier: 'tree',
  barrierColor: 0x2f4322,
  scatter: 'grass',
  scatterDensity: 0.5,
  foliage: 0x3f7d3a,
  foliageAlt: 0x2f6130,
  torch: 0xffb060,
  accent: 0x5fd1a0,
};

const SWAMP: RegionTheme = {
  key: 'swamp',
  background: 0x0a0714,
  skyTop: 0x1a1030,
  skyBottom: 0x2a1840,
  stars: true,
  fog: { color: 0x241436, near: 7, far: 26 },
  ambient: { color: 0x8f7bd0, intensity: 0.7 },
  hemisphere: { sky: 0x9d7bff, ground: 0x241a33, intensity: 0.85 },
  sun: { color: 0xb69bff, intensity: 1.0, position: [8, 16, 10] },
  ground: { color: 0x1d1630 },
  floor: { colorA: 0x2a2340, colorB: 0x231d36, roughness: 0.9, metalness: 0.05 },
  barrier: 'deadtree',
  barrierColor: 0x1a1526,
  scatter: 'reed',
  scatterDensity: 0.42,
  foliage: 0x5b3f8f,
  foliageAlt: 0x3f2c6b,
  torch: 0xb066ff,
  accent: 0x9b59ff,
};

const ICE: RegionTheme = {
  key: 'ice',
  background: 0x0a1620,
  skyTop: 0x123049,
  skyBottom: 0x76a7c9,
  stars: false,
  fog: { color: 0x9fc4dc, near: 11, far: 38 },
  ambient: { color: 0xbcd9ee, intensity: 0.9 },
  hemisphere: { sky: 0xe6f6ff, ground: 0x5f7f96, intensity: 1.2 },
  sun: { color: 0xdff1ff, intensity: 1.7, position: [10, 20, 6] },
  ground: { color: 0x86a7c0 },
  floor: { colorA: 0xa9c9dc, colorB: 0x93b7cd, roughness: 0.35, metalness: 0.2 },
  barrier: 'ice',
  barrierColor: 0x7fb4d6,
  scatter: 'shard',
  scatterDensity: 0.38,
  foliage: 0x9fdcff,
  foliageAlt: 0x6fb8e6,
  torch: 0x9fe0ff,
  accent: 0x66ccff,
};

const DESERT: RegionTheme = {
  key: 'desert',
  background: 0x1a0e08,
  skyTop: 0x3a1c0e,
  skyBottom: 0x9a5a2a,
  stars: false,
  fog: { color: 0x7a3f1e, near: 10, far: 34 },
  ambient: { color: 0xffb27a, intensity: 0.85 },
  hemisphere: { sky: 0xffcf9a, ground: 0x5a2f16, intensity: 1.05 },
  sun: { color: 0xffd39a, intensity: 1.75, position: [14, 16, 6] },
  ground: { color: 0x7a4a24 },
  floor: { colorA: 0x9a6a34, colorB: 0x8a5c2c, roughness: 0.95, metalness: 0.05 },
  barrier: 'mesa',
  barrierColor: 0x6b3f1f,
  scatter: 'stone',
  scatterDensity: 0.34,
  foliage: 0xc77b34,
  foliageAlt: 0x8a4f22,
  torch: 0xff8a3c,
  accent: 0xff6a2a,
};

/** Look-up by region name first, then by difficulty tier as a fallback. */
const BY_NAME: Record<string, RegionTheme> = {
  Eldergate: FOREST,
  'Shadow Vale': SWAMP,
  'Crystal Peaks': ICE,
  'Ember Desert': DESERT,
};

const BY_DIFFICULTY: RegionTheme[] = [FOREST, FOREST, SWAMP, ICE, DESERT];

export function getRegionTheme(name?: string, difficulty = 1): RegionTheme {
  if (name && BY_NAME[name]) return BY_NAME[name];
  return BY_DIFFICULTY[Math.min(Math.max(difficulty, 1), BY_DIFFICULTY.length - 1)];
}
