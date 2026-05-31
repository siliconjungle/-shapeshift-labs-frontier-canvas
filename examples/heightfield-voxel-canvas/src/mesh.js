export const TILE_SOURCES = ['grass', 'stone', 'clay'];
export const MATERIALS = [];
for (const topSource of TILE_SOURCES) {
  for (const sideSource of TILE_SOURCES) {
    for (const bevelSource of TILE_SOURCES) {
      for (const footSource of TILE_SOURCES) MATERIALS.push(`${topSource}|${sideSource}|${bevelSource}|${footSource}`);
    }
  }
}
export const SHAPE_MODES = ['full', 'boxy', 'rounded'];
export const TOP_MODES = ['flat', 'beveled', 'rounded'];
export const SLOPE_MODES = ['none', 'north', 'east', 'south', 'west'];

export const FACE_TOP = 0;
export const FACE_BEVEL = 1;
export const FACE_SIDE = 2;
export const FACE_FOOT = 3;
export const ATLAS_ROWS = 4;

export const HEIGHT_UNIT = 1;
const MAX_HEIGHT = 16;
const EPSILON = 1e-6;
const MASK_TILE_SIZE = 32;
const MASK_THRESHOLD = 128;
const DEFAULT_SIMPLIFY_TOLERANCE = 0.0625;
const ATLAS_TILE_SIZE = 128;
const ATLAS_TEXEL_INSET = 0.5;
const FLAT_EDGE_INSET = 0.045;
const BOXY_CORNER_CUT = 0.075;
const ROUNDED_CORNER_CUT = 0.235;
const SIDE_SEAM_OVERLAP = 0.006;
const BACKING_CAP_DROP = 0.018;
const NORMAL_UP = { x: 0, y: 1, z: 0 };

const BLOB_MASK_POLYGONS = {
  blob: null,
  curvy: null
};
const FOOTPRINT_POLYGON_CACHE = new Map();
const INSET_RING_CACHE = new WeakMap();
const POLYGON_AREA_CACHE = new WeakMap();
const POLYGON_CONVEX_CACHE = new WeakMap();
const LEGACY_MATERIAL_CUBES = {
  grass: { topSource: 'grass', sideSource: 'clay', bevelSource: 'grass', footSource: 'clay' },
  stone: { topSource: 'stone', sideSource: 'stone', bevelSource: 'stone', footSource: 'stone' },
  clay: { topSource: 'clay', sideSource: 'clay', bevelSource: 'clay', footSource: 'clay' }
};
const MATERIAL_INDEX_BY_KEY = new Map(MATERIALS.map((key, index) => [key, index]));

export const BLOB_RULE_SRC = {
  1: [4, 6, 12, 14, 36, 38, 44, 46, 132, 134, 140, 142, 164, 166, 172, 174],
  2: [84, 86, 212, 214],
  3: [92, 94, 220, 222],
  4: [124, 126, 252, 254],
  5: [116, 118, 244, 246],
  6: [80, 82, 88, 90, 208, 210, 216, 218],
  7: [16, 18, 24, 26, 48, 50, 56, 58, 144, 146, 152, 154, 176, 178, 184, 186],
  8: [28, 30, 60, 62, 156, 158, 188, 190],
  9: [117],
  10: [95],
  11: [255],
  12: [253],
  13: [113, 115, 121, 123],
  14: [21, 53, 149, 181],
  15: [87],
  16: [221],
  17: [127],
  18: [247],
  19: [209, 211, 217, 219],
  20: [29, 61, 157, 189],
  21: [125],
  22: [119],
  23: [199, 207, 231, 239],
  24: [215],
  25: [213],
  26: [81, 83, 89, 91],
  27: [31, 63, 159, 191],
  28: [241, 243, 249, 251],
  29: [20, 22, 52, 54, 148, 150, 180, 182],
  30: [65, 67, 73, 75, 97, 99, 105, 107],
  31: [17, 19, 25, 27, 49, 51, 57, 59, 145, 147, 153, 155, 177, 179, 185, 187],
  32: [1, 3, 9, 11, 33, 35, 41, 43, 129, 131, 137, 139, 161, 163, 169, 171],
  33: [23, 55, 151, 183],
  34: [223],
  35: [245],
  36: [85],
  37: [68, 70, 76, 78, 100, 102, 108, 110, 196, 198, 204, 206, 228, 230, 236, 238],
  38: [93],
  39: [112, 114, 120, 122, 240, 242, 248, 250],
  40: [5, 13, 37, 45, 133, 141, 165, 173],
  41: [71, 79, 103, 111],
  42: [197, 205, 229, 237],
  43: [69, 77, 101, 109],
  44: [64, 66, 72, 74, 96, 98, 104, 106, 192, 194, 200, 202, 224, 226, 232, 234],
  45: [7, 15, 39, 47, 135, 143, 167, 175],
  46: [193, 195, 201, 203, 225, 227, 233, 235],
  47: [0]
};

export function buildBlobFrameLookup(ruleSrc = BLOB_RULE_SRC) {
  let fallback = 0;
  for (const [frame, masks] of Object.entries(ruleSrc)) {
    if (masks.includes(0)) {
      fallback = Number(frame);
      break;
    }
  }
  const lookup = new Uint8Array(256).fill(fallback);
  for (const [frame, masks] of Object.entries(ruleSrc)) {
    for (const mask of masks) lookup[mask] = Number(frame);
  }
  return lookup;
}

const BLOB_FRAME_LOOKUP = buildBlobFrameLookup();
const BLOB_CANONICAL_MASK_BY_FRAME = buildCanonicalBlobMaskByFrame();

export function blobFrameForMask(mask) {
  return BLOB_FRAME_LOOKUP[Math.max(0, Math.min(255, Math.trunc(mask)))];
}

export function canonicalBlobMaskForFrame(frame) {
  return BLOB_CANONICAL_MASK_BY_FRAME.get(Number(frame)) ?? 0;
}

export function blobMaskForCells(cells, x, z) {
  let mask = 0;
  if (readTerrainCell(cells, x, z - 1)) mask |= 1;
  if (readTerrainCell(cells, x + 1, z - 1)) mask |= 2;
  if (readTerrainCell(cells, x + 1, z)) mask |= 4;
  if (readTerrainCell(cells, x + 1, z + 1)) mask |= 8;
  if (readTerrainCell(cells, x, z + 1)) mask |= 16;
  if (readTerrainCell(cells, x - 1, z + 1)) mask |= 32;
  if (readTerrainCell(cells, x - 1, z)) mask |= 64;
  if (readTerrainCell(cells, x - 1, z - 1)) mask |= 128;
  return mask;
}

export function blobMaskForCellsAtLayer(cells, x, z, layer = 1) {
  let mask = 0;
  if (readTerrainCellAtLayer(cells, x, z - 1, layer)) mask |= 1;
  if (readTerrainCellAtLayer(cells, x + 1, z - 1, layer)) mask |= 2;
  if (readTerrainCellAtLayer(cells, x + 1, z, layer)) mask |= 4;
  if (readTerrainCellAtLayer(cells, x + 1, z + 1, layer)) mask |= 8;
  if (readTerrainCellAtLayer(cells, x, z + 1, layer)) mask |= 16;
  if (readTerrainCellAtLayer(cells, x - 1, z + 1, layer)) mask |= 32;
  if (readTerrainCellAtLayer(cells, x - 1, z, layer)) mask |= 64;
  if (readTerrainCellAtLayer(cells, x - 1, z - 1, layer)) mask |= 128;
  return mask;
}

export function textureMaskForCellsAtLayer(cells, x, z, layer = 1) {
  const center = readTerrainCellAtLayer(cells, x, z, layer);
  if (!center) return 0;
  let mask = 0;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x, z - 1, layer))) mask |= 1;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x + 1, z - 1, layer))) mask |= 2;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x + 1, z, layer))) mask |= 4;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x + 1, z + 1, layer))) mask |= 8;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x, z + 1, layer))) mask |= 16;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x - 1, z + 1, layer))) mask |= 32;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x - 1, z, layer))) mask |= 64;
  if (sameTextureCell(center, readTerrainCellAtLayer(cells, x - 1, z - 1, layer))) mask |= 128;
  return mask;
}

export function blobShapeProfileForMask(mask) {
  const frame = blobFrameForMask(mask);
  const canonical = canonicalBlobMaskForFrame(frame);
  return decodeBlobMask(canonical);
}

function blobGeometryProfileForMask(mask) {
  const profile = blobShapeProfileForMask(mask);
  const raw = decodeBlobMask(mask);
  return {
    ...profile,
    ne: profile.ne || raw.ne,
    se: profile.se || raw.se,
    sw: profile.sw || raw.sw,
    nw: profile.nw || raw.nw
  };
}

export function blobFootprintPolygonForMask(mask, shape = 'boxy') {
  if (shape === 'full') {
    return [
      { x: -0.5, z: -0.5 },
      { x: 0.5, z: -0.5 },
      { x: 0.5, z: 0.5 },
      { x: -0.5, z: 0.5 }
    ];
  }
  if (shape === 'rounded') {
    const frame = blobFrameForMask(mask);
    const polygon = BLOB_MASK_POLYGONS.curvy?.[frame] || BLOB_MASK_POLYGONS.blob?.[frame];
    if (Array.isArray(polygon) && polygon.length >= 3) return polygon;
  }
  const profile = blobGeometryProfileForMask(mask);
  return coherentProfilePolygon(profile, shape);
}

export function terrainFootprintContainsPointAtLayer(cells, x, z, layer, worldX, worldZ) {
  const cell = readMeshCell(cells, x, z);
  if (!cell || cell.height < layer) return false;
  const local = {
    x: worldX - (x + 0.5),
    z: worldZ - (z + 0.5)
  };
  if (local.x < -0.52 || local.x > 0.52 || local.z < -0.52 || local.z > 0.52) return false;
  const neighborhood = meshNeighborhood(cells, x, z);
  const mask = blobMaskForNeighborhood(neighborhood, layer);
  const frame = blobFrameForMask(mask);
  return pointInPolygonInclusive(local, footprintPolygon(cell.shape, mask, frame));
}

export function setBlobFramePolygons(style, polygons) {
  const key = style === 'curvy' || style === 'rounded' ? 'curvy' : 'blob';
  if (!Array.isArray(polygons)) throw new TypeError('setBlobFramePolygons expected an array of frame polygons');
  BLOB_MASK_POLYGONS[key] = polygons.map((polygon) => clonePolygon(Array.isArray(polygon) ? polygon : []));
  FOOTPRINT_POLYGON_CACHE.clear();
}

export async function loadBlobMaskPolygonAtlas(sources = {}) {
  const entries = [
    ['blob', sources.blob || './assets/grey-blob-mask.png', { simplifyTolerance: 0.0625, smooth: false }],
    ['curvy', sources.curvy || './assets/grey-blob-mask-curvy.png', { simplifyTolerance: 0.046875, smooth: true }]
  ];
  const loaded = {};
  await Promise.all(entries.map(async ([style, url, options]) => {
    const image = await loadImage(url);
    const polygons = buildBlobMaskPolygonsFromImage(image, options);
    setBlobFramePolygons(style, polygons);
    loaded[style] = polygons;
  }));
  return loaded;
}

export function buildBlobMaskPolygonsFromImage(image, options = {}) {
  if (typeof document === 'undefined') throw new Error('buildBlobMaskPolygonsFromImage requires a browser canvas');
  const width = Number(image.naturalWidth || image.width);
  const height = Number(image.naturalHeight || image.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  return buildBlobMaskPolygonsFromPixels({ width, height, data: pixels }, options);
}

export function buildBlobMaskPolygonsFromPixels(source, options = {}) {
  const width = Number(source?.width) || 0;
  const height = Number(source?.height) || 0;
  const data = source?.data;
  const tileSize = Math.max(1, Math.trunc(options.tileSize || MASK_TILE_SIZE));
  const threshold = Number.isFinite(options.threshold) ? options.threshold : MASK_THRESHOLD;
  const simplifyTolerance = Number.isFinite(options.simplifyTolerance)
    ? options.simplifyTolerance
    : DEFAULT_SIMPLIFY_TOLERANCE;
  const smooth = options.smooth === true;
  if (!width || !height || !data) return [];
  const frameCount = Math.floor(width / tileSize) * Math.floor(height / tileSize);
  const polygons = new Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameX = (frame * tileSize) % width;
    const frameY = Math.floor((frame * tileSize) / width) * tileSize;
    const traced = traceMaskFramePolygon(data, width, height, frameX, frameY, tileSize, threshold, simplifyTolerance);
    polygons[frame] = cohereBlobPolygon(traced, frame, { tileSize, simplifyTolerance, smooth });
  }
  return polygons;
}

function buildCanonicalBlobMaskByFrame() {
  const out = new Map();
  for (const [frame, masks] of Object.entries(BLOB_RULE_SRC)) out.set(Number(frame), masks[0] ?? 0);
  return out;
}

function decodeBlobMask(mask) {
  return {
    n: (mask & 1) !== 0,
    ne: (mask & 2) !== 0,
    e: (mask & 4) !== 0,
    se: (mask & 8) !== 0,
    s: (mask & 16) !== 0,
    sw: (mask & 32) !== 0,
    w: (mask & 64) !== 0,
    nw: (mask & 128) !== 0
  };
}

export function cellKey(x, z) {
  return `${Math.trunc(x)},${Math.trunc(z)}`;
}

export function parseCellKey(key) {
  const comma = String(key).indexOf(',');
  if (comma < 0) return { x: 0, z: 0 };
  return {
    x: Number.parseInt(key.slice(0, comma), 10) || 0,
    z: Number.parseInt(key.slice(comma + 1), 10) || 0
  };
}

export function normalizeHeight(value) {
  const height = Math.trunc(Number(value) || 0);
  return Math.max(0, Math.min(MAX_HEIGHT, height));
}

export function normalizeTileSource(value, fallback = 'grass') {
  return TILE_SOURCES.includes(value) ? value : fallback;
}

export function normalizeShapeMode(value) {
  return SHAPE_MODES.includes(value) ? value : 'boxy';
}

export function normalizeTopMode(value) {
  return TOP_MODES.includes(value) ? value : 'beveled';
}

export function normalizeSlopeMode(value) {
  return SLOPE_MODES.includes(value) ? value : 'none';
}

export function readTerrainCell(cells, x, z) {
  const raw = cells?.[cellKey(x, z)];
  return normalizeRawTerrainCell(raw);
}

function normalizeRawTerrainCell(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const height = normalizeHeight(raw.height);
  if (height <= 0) return null;
  const legacyCube = LEGACY_MATERIAL_CUBES[raw.material] || LEGACY_MATERIAL_CUBES.grass;
  return {
    height,
    topSource: normalizeTileSource(raw.topSource ?? raw.cube?.top ?? legacyCube.topSource, legacyCube.topSource),
    baseTopSource: normalizeTileSource(raw.baseTopSource ?? raw.groundSource ?? raw.underSource ?? raw.topSource ?? raw.cube?.top ?? legacyCube.topSource, legacyCube.topSource),
    sideSource: normalizeTileSource(raw.sideSource ?? raw.wallSource ?? raw.cube?.side ?? legacyCube.sideSource, legacyCube.sideSource),
    bevelSource: normalizeTileSource(raw.bevelSource ?? raw.cube?.bevel ?? legacyCube.bevelSource, legacyCube.bevelSource),
    footSource: normalizeTileSource(raw.footSource ?? raw.baseSource ?? raw.cube?.foot ?? legacyCube.footSource, legacyCube.footSource),
    shape: normalizeShapeMode(raw.shape),
    textureShape: normalizeShapeMode(raw.textureShape ?? raw.materialShape ?? raw.shape),
    top: normalizeTopMode(raw.top),
    slope: normalizeSlopeMode(raw.slope)
  };
}

function readTerrainCellAtLayer(cells, x, z, layer) {
  const cell = readTerrainCell(cells, x, z);
  return cell && cell.height >= layer ? cell : null;
}

function sameTextureCell(center, neighbor) {
  return Boolean(
    neighbor &&
    neighbor.topSource === center.topSource &&
    neighbor.baseTopSource === center.baseTopSource &&
    neighbor.textureShape === center.textureShape
  );
}

export function createInitialTerrain(radius = 9) {
  const cells = {};
  const scale = Math.max(1, radius / 8);
  const wobble = (sx, sz) =>
    Math.sin(sx * 1.13 + sz * 0.37) * 0.1 +
    Math.sin(sx * 0.41 - sz * 0.91) * 0.08;
  const inBlob = (sx, sz, cx, cz, rx, rz, bias = 0) => {
    const dx = (sx - cx) / rx;
    const dz = (sz - cz) / rz;
    return dx * dx + dz * dz <= 1 + bias + wobble(sx, sz);
  };
  const inBaseIsland = (sx, sz) =>
    inBlob(sx, sz, -0.6, 0, 7.4, 6.5, 0.14) ||
    inBlob(sx, sz, 3.6, -0.7, 4.2, 5, -0.1) ||
    inBlob(sx, sz, -4.4, 1.4, 3.6, 4.2, -0.12);
  for (let z = -radius; z <= radius; z += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const sx = x / scale;
      const sz = z / scale;
      if (!inBaseIsland(sx, sz)) continue;
      let height = 1;
      let topSource = 'grass';
      let sideSource = 'clay';
      let bevelSource = 'grass';
      let shape = 'rounded';
      let top = 'beveled';
      let slope = 'none';

      const terraceEdge = 1.45 + Math.sin(sx * 0.62) * 0.52 + Math.sin(sx * 1.27 + 0.8) * 0.22;
      const mainPlateau = inBlob(sx, sz, -0.45, -2.35, 6.6, 4.35, 0.1) && sz <= terraceEdge;
      const frontShelf = inBlob(sx, sz, 0.6, 1.55, 3.4, 1.65, -0.2) && sz < 2.45;
      const rightShoulder = inBlob(sx, sz, 4.65, -0.45, 2.6, 2.45, -0.12);
      const upperShelf =
        inBlob(sx, sz, -3.4, -5.35, 2.6, 1.35, -0.04) ||
        inBlob(sx, sz, -1.4, -5.7, 1.7, 1, -0.16);

      if (mainPlateau) {
        height = 3;
      }
      if (frontShelf) height = Math.max(height, 2);
      if (rightShoulder) height = Math.max(height, 2);
      if (upperShelf) height = Math.max(height, 4);

      const stairColumn = Math.abs(sx + 4.15) <= 0.52 && sz >= -0.45 && sz <= 4.8;
      const lowerPath = Math.abs(sx + 4.15) <= 0.52 && sz > 4 && sz <= 5.8;
      const upperLanding = Math.abs(sx + 4.15) <= 0.52 && sz >= -1.3 && sz <= -0.35;
      if (stairColumn || lowerPath || upperLanding) {
        topSource = 'stone';
        sideSource = 'stone';
        bevelSource = 'stone';
        shape = 'boxy';
        top = 'flat';
        if (stairColumn) {
          if (sz < 0.75) {
            height = 3;
          } else if (sz < 2.45) {
            height = 2;
          } else {
            height = 1;
          }
        } else if (upperLanding) {
          height = Math.max(height, 3);
        } else {
          height = 1;
        }
      }
      cells[cellKey(x, z)] = {
        height,
        topSource,
        baseTopSource: topSource,
        sideSource,
        bevelSource,
        footSource: sideSource,
        shape,
        textureShape: shape,
        top,
        slope
      };
    }
  }
  return cells;
}

export function terrainBounds(cells) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const key of Object.keys(cells || {})) {
    const cell = cells[key];
    if (!cell || normalizeHeight(cell.height) <= 0) continue;
    const { x, z } = parseCellKey(key);
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x + 1);
    maxZ = Math.max(maxZ, z + 1);
  }
  if (!Number.isFinite(minX)) {
    return { x: -6, z: -6, width: 12, depth: 12 };
  }
  return {
    x: minX,
    z: minZ,
    width: Math.max(1, maxX - minX),
    depth: Math.max(1, maxZ - minZ)
  };
}

export function neighborMask(cells, x, z) {
  let mask = 0;
  if (readTerrainCell(cells, x, z - 1)) mask |= 1;
  if (readTerrainCell(cells, x + 1, z)) mask |= 2;
  if (readTerrainCell(cells, x, z + 1)) mask |= 4;
  if (readTerrainCell(cells, x - 1, z)) mask |= 8;
  if (readTerrainCell(cells, x + 1, z - 1)) mask |= 16;
  if (readTerrainCell(cells, x + 1, z + 1)) mask |= 32;
  if (readTerrainCell(cells, x - 1, z + 1)) mask |= 64;
  if (readTerrainCell(cells, x - 1, z - 1)) mask |= 128;
  return mask;
}

export function buildTerrainMesh(cells, options = {}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const shades = [];
  const indices = [];
  let triangleCount = 0;
  let cellCount = 0;
  let vertexCount = 0;
  const normalizedCells = {};
  const entries = [];
  for (const [key, raw] of Object.entries(cells || {})) {
    const { x, z } = parseCellKey(key);
    const cell = normalizeRawTerrainCell(raw);
    if (!cell) continue;
    normalizedCells[key] = cell;
    entries.push({ key, x, z, cell });
  }
  entries.sort((a, b) => a.z - b.z || a.x - b.x);
  for (const { x, z, cell } of entries) {
    cellCount += 1;
    const before = indices.length;
    buildCellMesh({
      cells: normalizedCells,
      x,
      z,
      cell,
      positions,
      normals,
      uvs,
      shades,
      indices,
      options
    });
    triangleCount += (indices.length - before) / 3;
  }
  vertexCount = positions.length / 3;
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    shades: new Float32Array(shades),
    indices: vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    summary: {
      cellCount,
      vertexCount,
      triangleCount
    }
  };
}

function buildCellMesh({ cells, x, z, cell, positions, normals, uvs, shades, indices }) {
  const neighborhood = meshNeighborhood(cells, x, z);
  const materialIndex = materialIndexFor(cell);
  const baseMaterialIndex = materialIndexFor({ ...cell, topSource: cell.baseTopSource || cell.topSource });
  for (let layer = 1; layer <= cell.height; layer += 1) {
    const layerTop = layer * HEIGHT_UNIT;
    const mask = blobMaskForNeighborhood(neighborhood, layer);
    const nextMask = layer < cell.height ? blobMaskForNeighborhood(neighborhood, layer + 1) : null;
    const frame = blobFrameForMask(mask);
    const textureMask = textureMaskForNeighborhood(neighborhood, cell, layer);
    const textureFrame = blobFrameForMask(textureMask);
    const profile = cell.shape === 'full' ? null : blobGeometryProfileForMask(mask);
    const polygon = footprintPolygon(cell.shape, mask, frame);
    const sidePolygon = sideWallFootprintPolygon(cell.shape, mask, frame);
    const edgeProfile = exposedEdgeProfileForNeighborhood(neighborhood, layer);
    const isTopLayer = layer === cell.height;
    const hasVisibleRoof = isTopLayer || nextMask !== mask;
    const slope = isTopLayer ? normalizeSlopeMode(cell.slope) : 'none';
    const slopeProfile = slope === 'none' ? null : createSlopeProfile(slope, layerTop);
    const rings = topRings(polygon, layerTop, slopeProfile ? 'flat' : isTopLayer ? cell.top : 'flat', edgeProfile, {
      edge: hasVisibleRoof
    });
    const firstRing = rings[0];
    const topShade = topShadowFromNeighborhood(neighborhood, layer);
    const winding = Math.sign(cachedPolygonSignedArea(sidePolygon)) || 1;
    for (let i = 0; i < sidePolygon.length; i += 1) {
      const a = sidePolygon[i];
      const b = sidePolygon[(i + 1) % sidePolygon.length];
      const topA = ringPointY(firstRing, a, slopeProfile);
      const topB = ringPointY(firstRing, b, slopeProfile);
      const sideTopA = isTopLayer && !slopeProfile ? layerTop : topA;
      const sideTopB = isTopLayer && !slopeProfile ? layerTop : topB;
      const side = cardinalEdgeSide(a, b);
      const neighborSurface = neighborEdgeSurfaceY(neighborhood, side, a, b, layer);
      const sideShade = sideShadow(a, b, topShade);
      if (neighborSurface) {
        const currentMid = (sideTopA + sideTopB) * 0.5;
        const neighborMid = (neighborSurface.aY + neighborSurface.bY) * 0.5;
        if (currentMid <= neighborMid + 0.001) continue;
        addSideQuad({
          positions,
          normals,
          uvs,
          shades,
          indices,
          materialIndex,
          splitFoot: cell.footSource !== cell.sideSource,
          splitLip: cell.bevelSource !== cell.sideSource,
          shade: sideShade,
          outward: edgeOutwardNormal(a, b, winding),
          a: worldPoint(x, z, a, neighborSurface.aY),
          b: worldPoint(x, z, b, neighborSurface.bY),
          c: worldPoint(x, z, b, sideTopB),
          d: worldPoint(x, z, a, sideTopA)
        });
        continue;
      }
      const low = exposedSideLowLayer(neighborhood, side, layer) * HEIGHT_UNIT;
      if (Math.max(sideTopA, sideTopB) - low <= 0.001) continue;
      addSideQuad({
        positions,
        normals,
        uvs,
        shades,
        indices,
        materialIndex,
        splitFoot: cell.footSource !== cell.sideSource,
        splitLip: cell.bevelSource !== cell.sideSource,
        shade: sideShade,
        outward: edgeOutwardNormal(a, b, winding),
        a: worldPoint(x, z, a, low),
        b: worldPoint(x, z, b, low),
        c: worldPoint(x, z, b, sideTopB),
        d: worldPoint(x, z, a, sideTopA)
      });
    }
    addCardinalSideGapFillers({
      neighborhood,
      layer,
      firstRing,
      slopeProfile,
      polygon: sidePolygon,
      x,
      z,
      materialIndex,
      splitFoot: cell.footSource !== cell.sideSource,
      splitLip: cell.bevelSource !== cell.sideSource,
      topShade,
      positions,
      normals,
      uvs,
      shades,
      indices
    });
    if (hasVisibleRoof) {
      const shadeContext = topShadeContextForNeighborhood(neighborhood, layer);
      addLayerBackingCap({
        x,
        z,
        layerTop,
        edgeProfile,
        materialIndex,
        shadeContext,
        topShade,
        positions,
        normals,
        uvs,
        shades,
        indices
      });
      addCornerCutCaps({
        shape: cell.shape,
        profile,
        layerTop,
        x,
        z,
        materialIndex,
        shadeContext,
        topShade,
        positions,
        normals,
        uvs,
        shades,
        indices
      });
      addTopSurface({
        shadeContext,
        positions,
        normals,
        uvs,
        shades,
        indices,
        materialIndex: baseMaterialIndex,
        x,
        z,
        rings,
        slopeProfile,
        layer,
        shade: topShade
      });
      if (cell.baseTopSource !== cell.topSource) {
        const texturePolygon = footprintPolygon(cell.textureShape, textureMask, textureFrame);
        addMaterialOverlaySurface({
          shadeContext,
          positions,
          normals,
          uvs,
          shades,
          indices,
          materialIndex,
          x,
          z,
          layerTop: layerTop + 0.008,
          polygon: texturePolygon,
          shade: Math.min(1.12, topShade + 0.035)
        });
      }
    }
  }
}

function readMeshCellAtLayer(cells, x, z, layer) {
  const cell = readMeshCell(cells, x, z);
  return cell && cell.height >= layer ? cell : null;
}

function meshNeighborhood(cells, x, z) {
  const north = readMeshCell(cells, x, z - 1);
  const east = readMeshCell(cells, x + 1, z);
  const south = readMeshCell(cells, x, z + 1);
  const west = readMeshCell(cells, x - 1, z);
  const northeast = readMeshCell(cells, x + 1, z - 1);
  const southeast = readMeshCell(cells, x + 1, z + 1);
  const southwest = readMeshCell(cells, x - 1, z + 1);
  const northwest = readMeshCell(cells, x - 1, z - 1);
  const south2 = readMeshCell(cells, x, z + 2);
  return {
    north,
    east,
    south,
    west,
    northeast,
    southeast,
    southwest,
    northwest,
    northHeight: north?.height || 0,
    eastHeight: east?.height || 0,
    southHeight: south?.height || 0,
    westHeight: west?.height || 0,
    south2Height: south2?.height || 0,
    northeastHeight: northeast?.height || 0,
    southeastHeight: southeast?.height || 0,
    southwestHeight: southwest?.height || 0,
    northwestHeight: northwest?.height || 0
  };
}

function textureMaskForNeighborhood(neighborhood, cell, layer) {
  let mask = 0;
  if (sameTextureCellAtLayer(cell, neighborhood.north, layer)) mask |= 1;
  if (sameTextureCellAtLayer(cell, neighborhood.northeast, layer)) mask |= 2;
  if (sameTextureCellAtLayer(cell, neighborhood.east, layer)) mask |= 4;
  if (sameTextureCellAtLayer(cell, neighborhood.southeast, layer)) mask |= 8;
  if (sameTextureCellAtLayer(cell, neighborhood.south, layer)) mask |= 16;
  if (sameTextureCellAtLayer(cell, neighborhood.southwest, layer)) mask |= 32;
  if (sameTextureCellAtLayer(cell, neighborhood.west, layer)) mask |= 64;
  if (sameTextureCellAtLayer(cell, neighborhood.northwest, layer)) mask |= 128;
  return mask;
}

function sameTextureCellAtLayer(center, neighbor, layer) {
  return neighbor && neighbor.height >= layer && sameTextureCell(center, neighbor);
}

function blobMaskForNeighborhood(neighborhood, layer) {
  let mask = 0;
  if (neighborhood.northHeight >= layer) mask |= 1;
  if (neighborhood.northeastHeight >= layer) mask |= 2;
  if (neighborhood.eastHeight >= layer) mask |= 4;
  if (neighborhood.southeastHeight >= layer) mask |= 8;
  if (neighborhood.southHeight >= layer) mask |= 16;
  if (neighborhood.southwestHeight >= layer) mask |= 32;
  if (neighborhood.westHeight >= layer) mask |= 64;
  if (neighborhood.northwestHeight >= layer) mask |= 128;
  return mask;
}

function exposedEdgeProfileForNeighborhood(neighborhood, layer) {
  return {
    north: neighborhood.northHeight < layer,
    east: neighborhood.eastHeight < layer,
    south: neighborhood.southHeight < layer,
    west: neighborhood.westHeight < layer
  };
}

function blobMaskForMeshLayer(cells, x, z, layer) {
  let mask = 0;
  if (readMeshCellAtLayer(cells, x, z - 1, layer)) mask |= 1;
  if (readMeshCellAtLayer(cells, x + 1, z - 1, layer)) mask |= 2;
  if (readMeshCellAtLayer(cells, x + 1, z, layer)) mask |= 4;
  if (readMeshCellAtLayer(cells, x + 1, z + 1, layer)) mask |= 8;
  if (readMeshCellAtLayer(cells, x, z + 1, layer)) mask |= 16;
  if (readMeshCellAtLayer(cells, x - 1, z + 1, layer)) mask |= 32;
  if (readMeshCellAtLayer(cells, x - 1, z, layer)) mask |= 64;
  if (readMeshCellAtLayer(cells, x - 1, z - 1, layer)) mask |= 128;
  return mask;
}

function exposedEdgeProfileAtLayer(cells, x, z, layer) {
  return {
    north: !readMeshCellAtLayer(cells, x, z - 1, layer),
    east: !readMeshCellAtLayer(cells, x + 1, z, layer),
    south: !readMeshCellAtLayer(cells, x, z + 1, layer),
    west: !readMeshCellAtLayer(cells, x - 1, z, layer)
  };
}

function exposedSideLowLayer(neighborhood, side, layer) {
  if (!side) return layer - 1;
  const neighbor = neighborForSide(neighborhood, side);
  return neighbor && neighbor.height >= layer ? layer : layer - 1;
}

function neighborEdgeSurfaceY(neighborhood, side, a, b, layer) {
  if (!side) return null;
  const neighbor = neighborForSide(neighborhood, side);
  if (!neighbor || neighbor.height < layer) return null;
  return {
    aY: cellSurfaceYAtLayer(neighbor, neighborLocalPoint(a, side), layer),
    bY: cellSurfaceYAtLayer(neighbor, neighborLocalPoint(b, side), layer)
  };
}

function neighborForSide(neighborhood, side) {
  if (side.name === 'north') return neighborhood.north;
  if (side.name === 'east') return neighborhood.east;
  if (side.name === 'south') return neighborhood.south;
  if (side.name === 'west') return neighborhood.west;
  return null;
}

const CARDINAL_SIDES = [
  { name: 'north', dx: 0, dz: -1, axis: 'z', fixed: -0.5, coord: 'x', outward: { x: 0, y: 0, z: -1 } },
  { name: 'east', dx: 1, dz: 0, axis: 'x', fixed: 0.5, coord: 'z', outward: { x: 1, y: 0, z: 0 } },
  { name: 'south', dx: 0, dz: 1, axis: 'z', fixed: 0.5, coord: 'x', outward: { x: 0, y: 0, z: 1 } },
  { name: 'west', dx: -1, dz: 0, axis: 'x', fixed: -0.5, coord: 'z', outward: { x: -1, y: 0, z: 0 } }
];

function addCardinalSideGapFillers({
  neighborhood,
  layer,
  firstRing,
  slopeProfile,
  polygon,
  x,
  z,
  materialIndex,
  splitFoot,
  splitLip,
  topShade,
  positions,
  normals,
  uvs,
  shades,
  indices
}) {
  for (const side of CARDINAL_SIDES) {
    const neighbor = neighborForSide(neighborhood, side);
    if (neighbor && neighbor.height >= layer) continue;
    const gaps = uncoveredBoundaryIntervals(polygon, side);
    if (!gaps.length) continue;
    const low = exposedSideLowLayer(neighborhood, side, layer) * HEIGHT_UNIT;
    for (const gap of gaps) {
      if (gap[1] - gap[0] <= 0.002) continue;
      const a = localPointForSide(side, gap[0]);
      const b = localPointForSide(side, gap[1]);
      const topA = slopeProfile ? ringPointY(firstRing, a, slopeProfile) : layer * HEIGHT_UNIT;
      const topB = slopeProfile ? ringPointY(firstRing, b, slopeProfile) : layer * HEIGHT_UNIT;
      if (Math.max(topA, topB) - low <= 0.001) continue;
      addSideQuad({
        positions,
        normals,
        uvs,
        shades,
        indices,
        materialIndex,
        splitFoot,
        splitLip,
        shade: sideShadow(a, b, topShade),
        outward: side.outward,
        a: worldPoint(x, z, a, low),
        b: worldPoint(x, z, b, low),
        c: worldPoint(x, z, b, topB),
        d: worldPoint(x, z, a, topA)
      });
    }
  }
}

function addLayerBackingCap({
  x,
  z,
  layerTop,
  edgeProfile,
  materialIndex,
  shadeContext,
  topShade,
  positions,
  normals,
  uvs,
  shades,
  indices
}) {
  const y = Math.max(0, layerTop - BACKING_CAP_DROP);
  const shade = Math.max(0.62, topShade * 0.72);
  const exposedSides =
    (edgeProfile.north ? 1 : 0) +
    (edgeProfile.east ? 1 : 0) +
    (edgeProfile.south ? 1 : 0) +
    (edgeProfile.west ? 1 : 0);
  if (exposedSides <= 0) return;
  if (exposedSides > 1) {
    const points = [
      { x: -0.5, z: -0.5 },
      { x: 0.5, z: -0.5 },
      { x: 0.5, z: 0.5 },
      { x: -0.5, z: 0.5 }
    ].map((local) => shadeTopPoint(shadeContext, local, worldPoint(x, z, local, y), shade));
    addFixedNormalQuad(
      positions,
      normals,
      uvs,
      shades,
      indices,
      points[0],
      points[1],
      points[2],
      points[3],
      materialIndex,
      FACE_BEVEL,
      NORMAL_UP,
      shade
    );
    return;
  }
  const width = 0.12;
  const strips = [];
  if (edgeProfile.north) strips.push([
    { x: -0.5, z: -0.5 },
    { x: 0.5, z: -0.5 },
    { x: 0.5, z: -0.5 + width },
    { x: -0.5, z: -0.5 + width }
  ]);
  if (edgeProfile.east) strips.push([
    { x: 0.5, z: -0.5 },
    { x: 0.5, z: 0.5 },
    { x: 0.5 - width, z: 0.5 },
    { x: 0.5 - width, z: -0.5 }
  ]);
  if (edgeProfile.south) strips.push([
    { x: 0.5, z: 0.5 },
    { x: -0.5, z: 0.5 },
    { x: -0.5, z: 0.5 - width },
    { x: 0.5, z: 0.5 - width }
  ]);
  if (edgeProfile.west) strips.push([
    { x: -0.5, z: 0.5 },
    { x: -0.5, z: -0.5 },
    { x: -0.5 + width, z: -0.5 },
    { x: -0.5 + width, z: 0.5 }
  ]);
  for (const strip of strips) {
    const points = strip.map((local) => shadeTopPoint(shadeContext, local, worldPoint(x, z, local, y), shade));
    addFixedNormalQuad(
      positions,
      normals,
      uvs,
      shades,
      indices,
      points[0],
      points[1],
      points[2],
      points[3],
      materialIndex,
      FACE_BEVEL,
      NORMAL_UP,
      shade
    );
  }
}

function addCornerCutCaps({
  shape,
  profile,
  layerTop,
  x,
  z,
  materialIndex,
  shadeContext,
  topShade,
  positions,
  normals,
  uvs,
  shades,
  indices
}) {
  const caps = cornerCutCapPolygons(profile, shape);
  if (!caps.length) return;
  const shade = Math.max(0.66, topShade * 0.94);
  for (const cap of caps) {
    const corner = shadeTopPoint(
      shadeContext,
      cap.corner,
      worldPoint(x, z, cap.corner, layerTop),
      shade
    );
    const edge = cap.edge.map((point) =>
      shadeTopPoint(shadeContext, point, worldPoint(x, z, point, layerTop), shade)
    );
      for (let i = 0; i < edge.length - 1; i += 1) {
      addFixedNormalTriangle(
        positions,
        normals,
        uvs,
        shades,
        indices,
        corner,
        edge[i],
        edge[i + 1],
        materialIndex,
        FACE_BEVEL,
        NORMAL_UP,
        shade
      );
    }
  }
}

function cornerCutCapPolygons(profile, shape) {
  if (!profile || shape === 'full') return [];
  const cut = shape === 'rounded' ? ROUNDED_CORNER_CUT : BOXY_CORNER_CUT;
  if (cut <= EPSILON) return [];
  const segments = shape === 'rounded' ? 5 : 1;
  const corners = [
    {
      exposed: !profile.n && !profile.w && !profile.nw,
      corner: { x: -0.5, z: -0.5 },
      from: { x: -0.5, z: -0.5 + cut },
      control: { x: -0.5, z: -0.5 },
      to: { x: -0.5 + cut, z: -0.5 }
    },
    {
      exposed: !profile.n && !profile.e && !profile.ne,
      corner: { x: 0.5, z: -0.5 },
      from: { x: 0.5 - cut, z: -0.5 },
      control: { x: 0.5, z: -0.5 },
      to: { x: 0.5, z: -0.5 + cut }
    },
    {
      exposed: !profile.s && !profile.e && !profile.se,
      corner: { x: 0.5, z: 0.5 },
      from: { x: 0.5, z: 0.5 - cut },
      control: { x: 0.5, z: 0.5 },
      to: { x: 0.5 - cut, z: 0.5 }
    },
    {
      exposed: !profile.s && !profile.w && !profile.sw,
      corner: { x: -0.5, z: 0.5 },
      from: { x: -0.5 + cut, z: 0.5 },
      control: { x: -0.5, z: 0.5 },
      to: { x: -0.5, z: 0.5 - cut }
    }
  ];
  const caps = [];
  for (const corner of corners) {
    if (!corner.exposed) continue;
    const edge = [corner.from];
    for (let step = 1; step < segments; step += 1) {
      edge.push(quadraticPoint(corner.from, corner.control, corner.to, step / segments));
    }
    edge.push(corner.to);
    caps.push({ corner: corner.corner, edge });
  }
  return caps;
}

function uncoveredBoundaryIntervals(polygon, side) {
  const intervals = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (!pointOnBoundary(a, side) || !pointOnBoundary(b, side)) continue;
    const start = Math.max(-0.5, Math.min(0.5, a[side.coord]));
    const end = Math.max(-0.5, Math.min(0.5, b[side.coord]));
    if (Math.abs(end - start) > 0.0001) intervals.push([Math.min(start, end), Math.max(start, end)]);
  }
  const merged = mergeIntervals(intervals);
  const gaps = [];
  let cursor = -0.5;
  for (const [start, end] of merged) {
    if (start - cursor > 0.002) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (0.5 - cursor > 0.002) gaps.push([cursor, 0.5]);
  return gaps;
}

function pointOnBoundary(point, side) {
  return Math.abs(point[side.axis] - side.fixed) < 0.0001;
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i += 1) {
    const previous = merged[merged.length - 1];
    const current = intervals[i];
    if (current[0] <= previous[1] + 0.0001) previous[1] = Math.max(previous[1], current[1]);
    else merged.push(current);
  }
  return merged;
}

function localPointForSide(side, value) {
  if (side.axis === 'z') return { x: value, z: side.fixed };
  return { x: side.fixed, z: value };
}

function neighborEdgeSurfaceYForCells(cells, x, z, a, b, layer) {
  const side = cardinalEdgeSide(a, b);
  if (!side) return null;
  const neighbor = readMeshCellAtLayer(cells, x + side.dx, z + side.dz, layer);
  if (!neighbor) return null;
  return {
    aY: cellSurfaceYAtLayer(neighbor, neighborLocalPoint(a, side), layer),
    bY: cellSurfaceYAtLayer(neighbor, neighborLocalPoint(b, side), layer)
  };
}

function cardinalEdgeSide(a, b) {
  const ax = roundCoord(a.x);
  const az = roundCoord(a.z);
  const bx = roundCoord(b.x);
  const bz = roundCoord(b.z);
  if (az === -0.5 && bz === -0.5) return { name: 'north', dx: 0, dz: -1 };
  if (ax === 0.5 && bx === 0.5) return { name: 'east', dx: 1, dz: 0 };
  if (az === 0.5 && bz === 0.5) return { name: 'south', dx: 0, dz: 1 };
  if (ax === -0.5 && bx === -0.5) return { name: 'west', dx: -1, dz: 0 };
  return null;
}

function neighborLocalPoint(point, side) {
  if (side.name === 'north') return { x: point.x, z: 0.5 };
  if (side.name === 'east') return { x: -0.5, z: point.z };
  if (side.name === 'south') return { x: point.x, z: -0.5 };
  if (side.name === 'west') return { x: 0.5, z: point.z };
  return point;
}

function cellSurfaceYAtLayer(cell, local, layer) {
  const layerTop = layer * HEIGHT_UNIT;
  if (layer !== cell.height) return layerTop;
  const slope = normalizeSlopeMode(cell.slope);
  if (slope === 'none') return layerTop;
  return ringPointY({ y: layerTop }, local, createSlopeProfile(slope, layerTop));
}

function readMeshCell(cells, x, z) {
  return cells[`${x},${z}`] || null;
}

function footprintPolygon(shape, mask, frame) {
  const resolvedShape = shape === 'full' || shape === 'rounded' ? shape : 'boxy';
  const resolvedFrame = frame || blobFrameForMask(mask);
  const key = `${resolvedShape}:${resolvedShape === 'full' ? 255 : mask}:${resolvedFrame}`;
  let polygon = FOOTPRINT_POLYGON_CACHE.get(key);
  if (!polygon) {
    polygon = blobFootprintPolygonForMask(resolvedShape === 'full' ? 255 : mask, resolvedShape);
    FOOTPRINT_POLYGON_CACHE.set(key, polygon);
  }
  return polygon;
}

function sideWallFootprintPolygon(shape, mask, frame) {
  return footprintPolygon(shape, mask, frame);
}

function blobOccupancy(profile) {
  return [
    [profile.nw && profile.n && profile.w, profile.n, profile.ne && profile.n && profile.e],
    [profile.w, true, profile.e],
    [profile.sw && profile.s && profile.w, profile.s, profile.se && profile.s && profile.e]
  ];
}

function coherentProfilePolygon(profile, shape) {
  return profileEdgePolygon(profile, shape);
}

function profileEdgePolygon(profile, shape) {
  const cut = shape === 'rounded' ? ROUNDED_CORNER_CUT : BOXY_CORNER_CUT;
  const roundedSegments = shape === 'rounded' ? 5 : 1;
  const corners = [
    {
      exposed: !profile.n && !profile.w && !profile.nw,
      corner: { x: -0.5, z: -0.5 },
      from: { x: -0.5, z: -0.5 + cut },
      control: { x: -0.5, z: -0.5 },
      to: { x: -0.5 + cut, z: -0.5 }
    },
    {
      exposed: !profile.n && !profile.e && !profile.ne,
      corner: { x: 0.5, z: -0.5 },
      from: { x: 0.5 - cut, z: -0.5 },
      control: { x: 0.5, z: -0.5 },
      to: { x: 0.5, z: -0.5 + cut }
    },
    {
      exposed: !profile.s && !profile.e && !profile.se,
      corner: { x: 0.5, z: 0.5 },
      from: { x: 0.5, z: 0.5 - cut },
      control: { x: 0.5, z: 0.5 },
      to: { x: 0.5 - cut, z: 0.5 }
    },
    {
      exposed: !profile.s && !profile.w && !profile.sw,
      corner: { x: -0.5, z: 0.5 },
      from: { x: -0.5 + cut, z: 0.5 },
      control: { x: -0.5, z: 0.5 },
      to: { x: -0.5, z: 0.5 - cut }
    }
  ];
  const out = [];
  for (const corner of corners) {
    if (!corner.exposed) {
      out.push(corner.corner);
      continue;
    }
    out.push(corner.from);
    if (roundedSegments <= 1) {
      out.push(corner.to);
      continue;
    }
    for (let step = 1; step < roundedSegments; step += 1) {
      out.push(quadraticPoint(corner.from, corner.control, corner.to, step / roundedSegments));
    }
    out.push(corner.to);
  }
  return removeCollinearPoints(removeDuplicatePoints(out));
}

function occupancyPolygon(occupied) {
  const cuts = [-0.5, -0.28, 0.28, 0.5];
  const edges = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (!occupied[row]?.[col]) continue;
      const x0 = cuts[col];
      const x1 = cuts[col + 1];
      const z0 = cuts[row];
      const z1 = cuts[row + 1];
      if (!occupied[row - 1]?.[col]) edges.push([{ x: x0, z: z0 }, { x: x1, z: z0 }]);
      if (!occupied[row]?.[col + 1]) edges.push([{ x: x1, z: z0 }, { x: x1, z: z1 }]);
      if (!occupied[row + 1]?.[col]) edges.push([{ x: x1, z: z1 }, { x: x0, z: z1 }]);
      if (!occupied[row]?.[col - 1]) edges.push([{ x: x0, z: z1 }, { x: x0, z: z0 }]);
    }
  }
  if (!edges.length) return [
    { x: -1 / 6, z: -1 / 6 },
    { x: 1 / 6, z: -1 / 6 },
    { x: 1 / 6, z: 1 / 6 },
    { x: -1 / 6, z: 1 / 6 }
  ];
  const byStart = new Map();
  for (const edge of edges) {
    const key = pointKey(edge[0]);
    const list = byStart.get(key) || [];
    list.push(edge);
    byStart.set(key, list);
  }
  const start = edges[0];
  const out = [start[0]];
  let current = start;
  let guard = 0;
  for (;;) {
    out.push(current[1]);
    const nextKey = pointKey(current[1]);
    if (nextKey === pointKey(start[0])) break;
    const candidates = byStart.get(nextKey) || [];
    current = candidates.shift();
    if (!current || guard++ > edges.length + 4) break;
  }
  return removeCollinearPoints(removeDuplicatePoints(out));
}

function pointKey(point) {
  return `${roundKey(point.x)},${roundKey(point.z)}`;
}

function roundKey(value) {
  return Math.round(value * 1000000) / 1000000;
}

function removeDuplicatePoints(points) {
  const out = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.z - point.z) < 0.0001) continue;
    out.push(point);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && Math.hypot(first.x - last.x, first.z - last.z) < 0.0001) out.pop();
  return out.length >= 3 ? out : [
    { x: -1 / 6, z: -1 / 6 },
    { x: 1 / 6, z: -1 / 6 },
    { x: 1 / 6, z: 1 / 6 },
    { x: -1 / 6, z: 1 / 6 }
  ];
}

function removeCollinearPoints(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 1) {
    const previous = points[(i - 1 + points.length) % points.length];
    const point = points[i];
    const next = points[(i + 1) % points.length];
    const crossValue = cross2(previous, point, next);
    if (Math.abs(crossValue) < 0.000001) continue;
    out.push(point);
  }
  return out.length >= 3 ? out : points;
}

function roundPolygonCorners(points, radius, segments) {
  const rounded = [];
  const winding = Math.sign(polygonSignedArea(points)) || 1;
  for (let i = 0; i < points.length; i += 1) {
    const previous = points[(i - 1 + points.length) % points.length];
    const point = points[i];
    const next = points[(i + 1) % points.length];
    const cornerTurn = cross2(previous, point, next);
    if (Math.sign(cornerTurn) !== winding) {
      rounded.push(point);
      continue;
    }
    const prevVector = normalize2({ x: previous.x - point.x, z: previous.z - point.z });
    const nextVector = normalize2({ x: next.x - point.x, z: next.z - point.z });
    const prevLength = Math.hypot(previous.x - point.x, previous.z - point.z);
    const nextLength = Math.hypot(next.x - point.x, next.z - point.z);
    const cut = Math.min(radius, prevLength * 0.42, nextLength * 0.42);
    if (cut <= EPSILON) {
      rounded.push(point);
      continue;
    }
    const a = { x: point.x + prevVector.x * cut, z: point.z + prevVector.z * cut };
    const b = { x: point.x + nextVector.x * cut, z: point.z + nextVector.z * cut };
    rounded.push(a);
    const count = Math.max(1, Math.floor(segments));
    for (let step = 1; step < count; step += 1) {
      const t = step / count;
      rounded.push(quadraticPoint(a, point, b, t));
    }
    rounded.push(b);
  }
  return removeDuplicatePoints(rounded);
}

function normalize2(point) {
  const length = Math.hypot(point.x, point.z) || 1;
  return { x: point.x / length, z: point.z / length };
}

function quadraticPoint(a, b, c, t) {
  const u = 1 - t;
  return {
    x: a.x * u * u + b.x * 2 * u * t + c.x * t * t,
    z: a.z * u * u + b.z * 2 * u * t + c.z * t * t
  };
}

function clonePolygon(polygon) {
  return polygon.map((point) => ({ x: point.x, z: point.z }));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('failed to load blob mask atlas: ' + url));
    image.src = url;
  });
}

function traceMaskFramePolygon(data, width, height, frameX, frameY, tileSize, threshold, simplifyTolerance) {
  const visible = new Uint8Array(tileSize * tileSize);
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const px = frameX + x;
      const py = frameY + y;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const offset = ((py * width) + px) * 4;
      visible[y * tileSize + x] = data[offset] < threshold && data[offset + 3] > 0 ? 1 : 0;
    }
  }
  const edges = [];
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      if (!visible[y * tileSize + x]) continue;
      if (!isMaskPixelVisible(visible, tileSize, x, y - 1)) edges.push([[x, y], [x + 1, y]]);
      if (!isMaskPixelVisible(visible, tileSize, x + 1, y)) edges.push([[x + 1, y], [x + 1, y + 1]]);
      if (!isMaskPixelVisible(visible, tileSize, x, y + 1)) edges.push([[x + 1, y + 1], [x, y + 1]]);
      if (!isMaskPixelVisible(visible, tileSize, x - 1, y)) edges.push([[x, y + 1], [x, y]]);
    }
  }
  if (!edges.length) {
    return [
      { x: -0.5, z: -0.5 },
      { x: 0.5, z: -0.5 },
      { x: 0.5, z: 0.5 },
      { x: -0.5, z: 0.5 }
    ];
  }
  const loops = traceBoundaryLoops(edges, tileSize);
  const largest = loops.sort((a, b) => Math.abs(polygonSignedArea(b)) - Math.abs(polygonSignedArea(a)))[0] || [];
  const simplified = simplifyClosedPolygon(removeCollinearPoints(largest), simplifyTolerance);
  return simplified.length >= 3 ? simplified : largest;
}

function cohereBlobPolygon(polygon, frame, options) {
  const profile = decodeBlobMask(canonicalBlobMaskForFrame(frame));
  const snap = 1.25 / Math.max(1, options.tileSize || MASK_TILE_SIZE);
  let coherent = snapPolygonToProfile(polygon, profile, snap);
  coherent = simplifyClosedPolygon(coherent, options.simplifyTolerance);
  if (options.smooth) coherent = chaikinSmoothPolygon(coherent, profile, 1);
  coherent = snapPolygonToProfile(coherent, profile, snap);
  coherent = removeCollinearPoints(removeDuplicatePoints(coherent));
  return coherent.length >= 3 ? coherent : polygon;
}

function snapPolygonToProfile(points, profile, snap) {
  return points.map((point) => {
    let x = point.x;
    let z = point.z;
    if (profile.w && Math.abs(x + 0.5) <= snap) x = -0.5;
    if (profile.e && Math.abs(x - 0.5) <= snap) x = 0.5;
    if (profile.n && Math.abs(z + 0.5) <= snap) z = -0.5;
    if (profile.s && Math.abs(z - 0.5) <= snap) z = 0.5;
    return { x, z };
  });
}

function chaikinSmoothPolygon(points, profile, iterations) {
  let current = points;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      if (isLockedProfileEdge(a, b, profile)) {
        next.push(a, b);
        continue;
      }
      next.push(
        { x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 },
        { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 }
      );
    }
    current = removeDuplicatePoints(next);
  }
  return current;
}

function isLockedProfileEdge(a, b, profile) {
  if (profile.n && Math.abs(a.z + 0.5) < 0.0001 && Math.abs(b.z + 0.5) < 0.0001) return true;
  if (profile.e && Math.abs(a.x - 0.5) < 0.0001 && Math.abs(b.x - 0.5) < 0.0001) return true;
  if (profile.s && Math.abs(a.z - 0.5) < 0.0001 && Math.abs(b.z - 0.5) < 0.0001) return true;
  if (profile.w && Math.abs(a.x + 0.5) < 0.0001 && Math.abs(b.x + 0.5) < 0.0001) return true;
  return false;
}

function isMaskPixelVisible(visible, tileSize, x, y) {
  return x >= 0 && y >= 0 && x < tileSize && y < tileSize && visible[y * tileSize + x] === 1;
}

function traceBoundaryLoops(edges, tileSize) {
  const byStart = new Map();
  for (let i = 0; i < edges.length; i += 1) {
    const key = gridKey(edges[i][0]);
    const list = byStart.get(key) || [];
    list.push(i);
    byStart.set(key, list);
  }
  const used = new Uint8Array(edges.length);
  const loops = [];
  for (let i = 0; i < edges.length; i += 1) {
    if (used[i]) continue;
    const start = edges[i][0];
    const loop = [gridPointToLocal(start, tileSize)];
    let currentIndex = i;
    let guard = 0;
    while (!used[currentIndex] && guard <= edges.length + 2) {
      guard += 1;
      used[currentIndex] = 1;
      const end = edges[currentIndex][1];
      loop.push(gridPointToLocal(end, tileSize));
      if (gridKey(end) === gridKey(start)) break;
      const candidates = byStart.get(gridKey(end)) || [];
      currentIndex = candidates.find((candidate) => !used[candidate]);
      if (currentIndex === undefined) break;
    }
    const clean = removeDuplicatePoints(loop);
    if (clean.length >= 3) loops.push(clean);
  }
  return loops;
}

function gridKey(point) {
  return `${point[0]},${point[1]}`;
}

function gridPointToLocal(point, tileSize) {
  return {
    x: point[0] / tileSize - 0.5,
    z: point[1] / tileSize - 0.5
  };
}

function simplifyClosedPolygon(points, tolerance) {
  if (!Number.isFinite(tolerance) || tolerance <= 0 || points.length <= 4) return points;
  let simplified = points;
  for (;;) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < simplified.length; i += 1) {
      const previous = simplified[(i - 1 + simplified.length) % simplified.length];
      const point = simplified[i];
      const next = simplified[(i + 1) % simplified.length];
      const distance = pointLineDistance(point, previous, next);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestIndex < 0 || bestDistance > tolerance || simplified.length <= 4) break;
    simplified = simplified.slice(0, bestIndex).concat(simplified.slice(bestIndex + 1));
  }
  return removeCollinearPoints(simplified);
}

function pointLineDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const denom = Math.hypot(dx, dz);
  if (denom <= EPSILON) return Math.hypot(point.x - a.x, point.z - a.z);
  return Math.abs((dz * point.x) - (dx * point.z) + b.x * a.z - b.z * a.x) / denom;
}

function topRings(polygon, height, mode, edgeProfile, options = {}) {
  const edge = options.edge !== false && hasExposedEdge(edgeProfile);
  if (mode === 'flat' || !isConvexPolygon(polygon)) {
    if (!edge) return [{ y: height, face: FACE_TOP, points: polygon }];
    const inner = insetRing(polygon, edgeProfile, FLAT_EDGE_INSET);
    return [
      { y: height, face: FACE_TOP, points: polygon },
      { y: height, face: FACE_BEVEL, points: inner },
      { y: height, face: FACE_TOP, points: inner }
    ];
  }
  const d = Math.min(height * 0.42, mode === 'rounded' ? 0.13 : 0.105);
  const inset = mode === 'rounded' ? 0.18 : 0.13;
  if (mode === 'rounded') {
    const mid = insetRing(polygon, edgeProfile, edge ? inset * 0.45 : 0);
    const inner = insetRing(polygon, edgeProfile, edge ? inset : 0);
    return [
      { y: height - d, face: FACE_SIDE, points: polygon },
      { y: height - d * 0.35, face: FACE_BEVEL, points: mid },
      { y: height, face: FACE_BEVEL, points: inner },
      { y: height, face: FACE_TOP, points: inner }
    ];
  }
  const inner = insetRing(polygon, edgeProfile, edge ? inset : 0);
  return [
    { y: height - d, face: FACE_SIDE, points: polygon },
    { y: height, face: FACE_BEVEL, points: inner },
    { y: height, face: FACE_TOP, points: inner }
  ];
}

function hasExposedEdge(edgeProfile) {
  return edgeProfile.north || edgeProfile.east || edgeProfile.south || edgeProfile.west;
}

function isConvexPolygon(points) {
  const cached = POLYGON_CONVEX_CACHE.get(points);
  if (cached !== undefined) return cached;
  if (points.length < 4) return true;
  let sign = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const crossValue = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(crossValue) < 0.000001) continue;
    const nextSign = Math.sign(crossValue);
    if (sign && nextSign !== sign) {
      POLYGON_CONVEX_CACHE.set(points, false);
      return false;
    }
    sign = nextSign;
  }
  POLYGON_CONVEX_CACHE.set(points, true);
  return true;
}

function triangulatePolygon(points) {
  const clean = removeCollinearPoints(removeDuplicatePoints(points));
  if (clean.length < 3) return [];
  if (clean.length === 3) return [[0, 1, 2]];
  if (isConvexPolygon(clean)) {
    const out = [];
    for (let i = 1; i < clean.length - 1; i += 1) out.push([0, i, i + 1]);
    return out;
  }
  const winding = Math.sign(polygonSignedArea(clean)) || 1;
  const remaining = clean.map((_, index) => index);
  const triangles = [];
  let guard = 0;
  while (remaining.length > 3 && guard < clean.length * clean.length) {
    guard += 1;
    let clipped = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const ia = remaining[(i - 1 + remaining.length) % remaining.length];
      const ib = remaining[i];
      const ic = remaining[(i + 1) % remaining.length];
      const a = clean[ia];
      const b = clean[ib];
      const c = clean[ic];
      const turn = cross2(a, b, c);
      if (Math.sign(turn) !== winding || Math.abs(turn) < EPSILON) continue;
      let contains = false;
      for (const index of remaining) {
        if (index === ia || index === ib || index === ic) continue;
        if (pointInTriangle(clean[index], a, b, c)) {
          contains = true;
          break;
        }
      }
      if (contains) continue;
      triangles.push([ia, ib, ic]);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (remaining.length === 3) triangles.push([remaining[0], remaining[1], remaining[2]]);
  if (triangles.length) return triangles.map((tri) => tri.map((index) => index));
  const fallback = [];
  for (let i = 1; i < clean.length - 1; i += 1) fallback.push([0, i, i + 1]);
  return fallback;
}

function pointInTriangle(point, a, b, c) {
  const area = Math.abs(cross2(a, b, c));
  const a1 = Math.abs(cross2(point, a, b));
  const a2 = Math.abs(cross2(point, b, c));
  const a3 = Math.abs(cross2(point, c, a));
  return Math.abs(area - (a1 + a2 + a3)) < 0.00001;
}

function polygonSignedArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return area * 0.5;
}

function cachedPolygonSignedArea(points) {
  const cached = POLYGON_AREA_CACHE.get(points);
  if (cached !== undefined) return cached;
  const area = polygonSignedArea(points);
  POLYGON_AREA_CACHE.set(points, area);
  return area;
}

function cross2(a, b, c) {
  return (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
}

function insetRing(points, edgeProfile, amount) {
  if (amount <= EPSILON) return points;
  const key = `${edgeProfile.north ? 1 : 0}${edgeProfile.east ? 1 : 0}${edgeProfile.south ? 1 : 0}${edgeProfile.west ? 1 : 0}:${amount}`;
  let cachedByEdge = INSET_RING_CACHE.get(points);
  if (!cachedByEdge) {
    cachedByEdge = new Map();
    INSET_RING_CACHE.set(points, cachedByEdge);
  } else {
    const cached = cachedByEdge.get(key);
    if (cached) return cached;
  }
  const ring = points.map((point) => {
    const east = edgeProfile.east ? positiveEdgeInfluence(point.x) : 0;
    const west = edgeProfile.west ? negativeEdgeInfluence(point.x) : 0;
    const south = edgeProfile.south ? positiveEdgeInfluence(point.z) : 0;
    const north = edgeProfile.north ? negativeEdgeInfluence(point.z) : 0;
    return {
      x: point.x - east * amount + west * amount,
      z: point.z - south * amount + north * amount
    };
  });
  cachedByEdge.set(key, ring);
  return ring;
}

function positiveEdgeInfluence(value) {
  return value <= 0 ? 0 : Math.min(1, value / 0.5);
}

function negativeEdgeInfluence(value) {
  return value >= 0 ? 0 : Math.min(1, -value / 0.5);
}

function roundCoord(value) {
  if (Math.abs(value - 0.5) < 0.0001) return 0.5;
  if (Math.abs(value + 0.5) < 0.0001) return -0.5;
  return value;
}

function addTopSurface({ shadeContext, positions, normals, uvs, shades, indices, materialIndex, x, z, rings, shade, slopeProfile = null, cutout = null }) {
  for (let r = 0; r < rings.length - 1; r += 1) {
    const outer = rings[r].points;
    const inner = rings[r + 1].points;
    const face = rings[r + 1].face;
    for (let i = 0; i < outer.length; i += 1) {
      const next = (i + 1) % outer.length;
      const a = shadeTopPoint(shadeContext, outer[i], worldPoint(x, z, outer[i], ringPointY(rings[r], outer[i], slopeProfile)), shade);
      const b = shadeTopPoint(shadeContext, outer[next], worldPoint(x, z, outer[next], ringPointY(rings[r], outer[next], slopeProfile)), shade);
      const c = shadeTopPoint(shadeContext, inner[next], worldPoint(x, z, inner[next], ringPointY(rings[r + 1], inner[next], slopeProfile)), shade);
      const d = shadeTopPoint(shadeContext, inner[i], worldPoint(x, z, inner[i], ringPointY(rings[r + 1], inner[i], slopeProfile)), shade);
      if (sameLocalPoint(outer[i], inner[i]) && sameLocalPoint(outer[next], inner[next])) continue;
      addShadedQuad(positions, normals, uvs, shades, indices, a, b, c, d, materialIndex, face, NORMAL_UP, shade);
    }
  }
  const top = rings[rings.length - 1];
  const ring = removeCollinearPoints(removeDuplicatePoints(top.points));
  const triangles = triangulatePolygon(ring);
  const addTopTriangle = slopeProfile ? addTriangle : addFixedNormalTriangle;
  for (const [ia, ib, ic] of triangles) {
    if (cutout && triangleCentroidInsidePolygon(ring[ia], ring[ib], ring[ic], cutout)) continue;
    addTopTriangle(
      positions,
      normals,
      uvs,
      shades,
      indices,
      shadeTopPoint(shadeContext, ring[ia], worldPoint(x, z, ring[ia], ringPointY(top, ring[ia], slopeProfile)), shade),
      shadeTopPoint(shadeContext, ring[ib], worldPoint(x, z, ring[ib], ringPointY(top, ring[ib], slopeProfile)), shade),
      shadeTopPoint(shadeContext, ring[ic], worldPoint(x, z, ring[ic], ringPointY(top, ring[ic], slopeProfile)), shade),
      materialIndex,
      FACE_TOP,
      NORMAL_UP,
      shade
    );
  }
}

function addMaterialOverlaySurface({ shadeContext, positions, normals, uvs, shades, indices, materialIndex, x, z, layerTop, polygon, shade }) {
  const ring = removeCollinearPoints(removeDuplicatePoints(polygon));
  const triangles = triangulatePolygon(ring);
  for (const [ia, ib, ic] of triangles) {
    addFixedNormalTriangle(
      positions,
      normals,
      uvs,
      shades,
      indices,
      shadeTopPoint(shadeContext, ring[ia], worldPoint(x, z, ring[ia], layerTop), shade),
      shadeTopPoint(shadeContext, ring[ib], worldPoint(x, z, ring[ib], layerTop), shade),
      shadeTopPoint(shadeContext, ring[ic], worldPoint(x, z, ring[ic], layerTop), shade),
      materialIndex,
      FACE_TOP,
      NORMAL_UP,
      shade
    );
  }
}

function triangleCentroidInsidePolygon(a, b, c, polygon) {
  return pointInPolygon({
    x: (a.x + b.x + c.x) / 3,
    z: (a.z + b.z + c.z) / 3
  }, polygon);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = ((a.z > point.z) !== (b.z > point.z)) &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / ((b.z - a.z) || EPSILON) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygonInclusive(point, polygon) {
  for (let i = 0; i < polygon.length; i += 1) {
    if (pointNearSegment(point, polygon[i], polygon[(i + 1) % polygon.length], 0.0025)) return true;
  }
  return pointInPolygon(point, polygon);
}

function pointNearSegment(point, a, b, tolerance) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= EPSILON) return Math.hypot(point.x - a.x, point.z - a.z) <= tolerance;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
  const x = a.x + dx * t;
  const z = a.z + dz * t;
  return Math.hypot(point.x - x, point.z - z) <= tolerance;
}

function sameLocalPoint(a, b) {
  return Math.abs(a.x - b.x) < 0.00001 && Math.abs(a.z - b.z) < 0.00001;
}

function topShadeContextForNeighborhood(neighborhood, layer) {
  const context = {
    layer,
    north: neighborhood.northHeight,
    east: neighborhood.eastHeight,
    south: neighborhood.southHeight,
    west: neighborhood.westHeight,
    northwest: neighborhood.northwestHeight,
    northeast: neighborhood.northeastHeight,
    southeast: neighborhood.southeastHeight,
    southwest: neighborhood.southwestHeight
  };
  context.active =
    context.north !== layer ||
    context.east !== layer ||
    context.south !== layer ||
    context.west !== layer ||
    context.northwest !== layer ||
    context.northeast !== layer ||
    context.southeast !== layer ||
    context.southwest !== layer;
  return context;
}

function shadeTopPoint(context, local, point, baseShade) {
  if (!context.active) {
    point.shade = baseShade;
    return point;
  }
  let shade = baseShade;
  const layer = context.layer;
  const n = negativeEdgeInfluence(local.z);
  const e = positiveEdgeInfluence(local.x);
  const s = positiveEdgeInfluence(local.z);
  const w = negativeEdgeInfluence(local.x);
  shade -= exposedTopDrop(layer, context.north) * n;
  shade -= exposedTopDrop(layer, context.east) * e;
  shade -= exposedTopDrop(layer, context.south) * s;
  shade -= exposedTopDrop(layer, context.west) * w;
  shade -= cornerTopDrop(layer, context.northwest) * Math.min(n, w);
  shade -= cornerTopDrop(layer, context.northeast) * Math.min(n, e);
  shade -= cornerTopDrop(layer, context.southeast) * Math.min(s, e);
  shade -= cornerTopDrop(layer, context.southwest) * Math.min(s, w);
  shade -= higherNeighborShadow(layer, context.north) * n;
  shade -= higherNeighborShadow(layer, context.east) * e;
  shade -= higherNeighborShadow(layer, context.south) * s;
  shade -= higherNeighborShadow(layer, context.west) * w;
  point.shade = Math.max(0.56, Math.min(1.12, shade));
  return point;
}

function exposedTopDrop(layer, neighborHeight) {
  if (neighborHeight >= layer) return 0;
  return Math.min(0.1, 0.035 + (layer - neighborHeight) * 0.018);
}

function cornerTopDrop(layer, neighborHeight) {
  if (neighborHeight >= layer) return 0;
  return Math.min(0.065, 0.02 + (layer - neighborHeight) * 0.012);
}

function higherNeighborShadow(layer, neighborHeight) {
  if (neighborHeight <= layer) return 0;
  return Math.min(0.16, 0.06 + (neighborHeight - layer) * 0.032);
}

function edgeOutwardNormal(a, b, winding) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  const sign = winding >= 0 ? 1 : -1;
  return { x: (dz / length) * sign, y: 0, z: (-dx / length) * sign };
}

function addSideQuad({ positions, normals, uvs, shades, indices, materialIndex, splitFoot = true, splitLip = true, shade, outward, a, b, c, d }) {
  const baseY = Math.floor((Math.min(a.y, b.y, c.y, d.y) + EPSILON) / HEIGHT_UNIT) * HEIGHT_UNIT;
  const topY = Math.max(a.y, b.y, c.y, d.y);
  const height = Math.max(EPSILON, topY - baseY);
  const footEnd = splitFoot ? Math.min(0.22, height * 0.34) / height : 0;
  const lipStart = splitLip ? 1 - Math.min(0.18, height * 0.32) / height : 1;
  if (splitFoot) {
    addSideSegment({
      positions,
      normals,
      uvs,
      shades,
      indices,
      materialIndex,
      shade: shade * 0.94,
      outward,
      a,
      b,
      c,
      d,
      baseY,
      topY,
      t0: 0,
      t1: Math.min(footEnd, 0.42),
      face: FACE_FOOT
    });
  }
  if (lipStart > footEnd + 0.025 || !splitLip) {
    addSideSegment({
      positions,
      normals,
      uvs,
      shades,
      indices,
      materialIndex,
      shade,
      outward,
      a,
      b,
      c,
      d,
      baseY,
      topY,
      t0: footEnd,
      t1: lipStart,
      face: FACE_SIDE
    });
  }
  if (!splitLip) return;
  addSideSegment({
    positions,
    normals,
    uvs,
    shades,
    indices,
    materialIndex,
    shade: Math.min(1.12, shade * 1.05),
    outward,
    a,
    b,
    c,
    d,
    baseY,
    topY,
    t0: Math.max(footEnd, lipStart),
    t1: 1,
    face: FACE_BEVEL
  });
}

function addSideSegment({ positions, normals, uvs, shades, indices, materialIndex, shade, outward, a, b, c, d, baseY, topY, t0, t1, face }) {
  if (t1 - t0 <= 0.002) return;
  const sideUv = createSideUvProjector(a, b);
  const left0 = interpolateSideEdge(a, d, t0);
  const right0 = interpolateSideEdge(b, c, t0);
  const right1 = interpolateSideEdge(b, c, t1);
  const left1 = interpolateSideEdge(a, d, t1);
  const p0 = shadeSidePoint(sidePoint(left0, sideUv, baseY, topY, outward), baseY, topY, shade);
  const p1 = shadeSidePoint(sidePoint(right0, sideUv, baseY, topY, outward), baseY, topY, shade);
  const p2 = shadeSidePoint(sidePoint(right1, sideUv, baseY, topY, outward), baseY, topY, shade);
  const p3 = shadeSidePoint(sidePoint(left1, sideUv, baseY, topY, outward), baseY, topY, shade);
  addFixedNormalQuad(positions, normals, uvs, shades, indices, p0, p1, p2, p3, materialIndex, face, outward, shade);
}

function interpolateSideEdge(low, high, t) {
  return {
    x: low.x + (high.x - low.x) * t,
    y: low.y + (high.y - low.y) * t,
    z: low.z + (high.z - low.z) * t
  };
}

function shadeSidePoint(point, baseY, topY, shade) {
  const height = Math.max(EPSILON, topY - baseY);
  const t = clamp01((point.y - baseY) / height);
  const lip = 1 - Math.abs(t - 0.86) / 0.14;
  const foot = 1 - Math.abs(t - 0.08) / 0.18;
  const vertexShade = shade * (0.88 + t * 0.16) - Math.max(0, foot) * 0.045 + Math.max(0, lip) * 0.035;
  point.shade = Math.max(0.58, Math.min(1.1, vertexShade));
  return point;
}

function addShadedQuad(positions, normals, uvs, shades, indices, a, b, c, d, materialIndex, face, desiredNormal, shade) {
  if (shouldFlipQuad(a, b, c, d, shade)) {
    addTriangle(positions, normals, uvs, shades, indices, a, b, d, materialIndex, face, desiredNormal, shade);
    addTriangle(positions, normals, uvs, shades, indices, b, c, d, materialIndex, face, desiredNormal, shade);
  } else {
    addTriangle(positions, normals, uvs, shades, indices, a, b, c, materialIndex, face, desiredNormal, shade);
    addTriangle(positions, normals, uvs, shades, indices, a, c, d, materialIndex, face, desiredNormal, shade);
  }
}

function addFixedNormalQuad(positions, normals, uvs, shades, indices, a, b, c, d, materialIndex, face, normal, shade) {
  if (shouldFlipQuad(a, b, c, d, shade)) {
    addFixedNormalTriangle(positions, normals, uvs, shades, indices, a, b, d, materialIndex, face, normal, shade);
    addFixedNormalTriangle(positions, normals, uvs, shades, indices, b, c, d, materialIndex, face, normal, shade);
  } else {
    addFixedNormalTriangle(positions, normals, uvs, shades, indices, a, b, c, materialIndex, face, normal, shade);
    addFixedNormalTriangle(positions, normals, uvs, shades, indices, a, c, d, materialIndex, face, normal, shade);
  }
}

function shouldFlipQuad(a, b, c, d, fallback) {
  return vertexShade(a, fallback) + vertexShade(c, fallback) >
    vertexShade(b, fallback) + vertexShade(d, fallback);
}

function vertexShade(point, fallback) {
  return Number.isFinite(point?.shade) ? point.shade : fallback;
}

function createSideUvProjector(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  const tx = dx / length;
  const tz = dz / length;
  const startProjection = (a.x * tx) + (a.z * tz);
  return {
    tx,
    tz,
    startProjection
  };
}

function sidePoint(point, projector, baseY, topY, outward) {
  const y = sideSkirtY(point.y, baseY, topY);
  return {
    x: point.x,
    y,
    z: point.z,
    sideU: sideTileU(point, projector),
    sideV: sideTileV(point.y, baseY)
  };
}

function sideSkirtY(y, baseY, topY) {
  if (Math.abs(y - baseY) < 0.0001) return Math.max(0, y - SIDE_SEAM_OVERLAP);
  if (Math.abs(y - topY) < 0.0001) return y + SIDE_SEAM_OVERLAP;
  return y;
}

function sideTileU(point, projector) {
  const pointProjection = (point.x * projector.tx) + (point.z * projector.tz);
  return pointProjection - projector.startProjection;
}

function sideTileV(y, baseY) {
  return clamp01(1 - ((y - baseY) / HEIGHT_UNIT));
}

function addTriangle(positions, normals, uvs, shades, indices, a, b, c, materialIndex, face, desiredNormal, shade = 1) {
  const normal = triangleNormal(a, b, c);
  let p0 = a;
  let p1 = b;
  let p2 = c;
  let n = normal;
  if (dot(normal, desiredNormal) < 0) {
    p1 = c;
    p2 = b;
    n = { x: -normal.x, y: -normal.y, z: -normal.z };
  }
  const base = positions.length / 3;
  pushVertex(positions, normals, uvs, shades, p0, n, materialIndex, face, shade);
  pushVertex(positions, normals, uvs, shades, p1, n, materialIndex, face, shade);
  pushVertex(positions, normals, uvs, shades, p2, n, materialIndex, face, shade);
  indices.push(base, base + 1, base + 2);
}

function addFixedNormalTriangle(positions, normals, uvs, shades, indices, a, b, c, materialIndex, face, normal, shade = 1) {
  const base = positions.length / 3;
  pushVertex(positions, normals, uvs, shades, a, normal, materialIndex, face, shade);
  pushVertex(positions, normals, uvs, shades, b, normal, materialIndex, face, shade);
  pushVertex(positions, normals, uvs, shades, c, normal, materialIndex, face, shade);
  indices.push(base, base + 1, base + 2);
}

function pushVertex(positions, normals, uvs, shades, point, normal, materialIndex, face, shade) {
  positions.push(point.x, point.y, point.z);
  normals.push(normal.x, normal.y, normal.z);
  pushAtlasUv(uvs, materialIndex, face, point);
  shades.push(clamp01(vertexShade(point, shade)));
}

function topShadowFromNeighborhood(neighborhood, ownHeight) {
  let shade = 1;
  const north = neighborhood.northHeight;
  const south = neighborhood.southHeight;
  const south2 = neighborhood.south2Height || 0;
  const west = neighborhood.westHeight;
  const east = neighborhood.eastHeight;
  const northwest = neighborhood.northwestHeight;
  const southwest = neighborhood.southwestHeight;
  if (north > ownHeight) shade -= Math.min(0.18, (north - ownHeight) * 0.034 + 0.045);
  if (south > ownHeight) shade -= Math.min(0.34, (south - ownHeight) * 0.058 + 0.09);
  if (south2 > ownHeight) shade -= Math.min(0.18, (south2 - ownHeight) * 0.028);
  if (southwest > ownHeight) shade -= Math.min(0.18, (southwest - ownHeight) * 0.032);
  if (northwest > ownHeight) shade -= Math.min(0.14, (northwest - ownHeight) * 0.026);
  if (west > ownHeight) shade -= Math.min(0.2, (west - ownHeight) * 0.04 + 0.04);
  if (east > ownHeight) shade -= Math.min(0.2, (east - ownHeight) * 0.04 + 0.04);
  return Math.max(0.56, Math.min(1.12, shade));
}

function sideShadow(a, b, topShade) {
  const ax = roundCoord(a.x);
  const az = roundCoord(a.z);
  const bx = roundCoord(b.x);
  const bz = roundCoord(b.z);
  let shade = 0.98;
  if (az === 0.5 && bz === 0.5) shade = 1.02;
  else if (ax === -0.5 && bx === -0.5) shade = 0.99;
  else if (ax === 0.5 && bx === 0.5) shade = 0.99;
  else if (az === -0.5 && bz === -0.5) shade = 0.94;
  shade -= Math.max(0, 1 - topShade) * 0.18;
  return Math.max(0.74, Math.min(1.08, shade));
}

function createSlopeProfile(direction, layerTop) {
  return {
    direction: normalizeSlopeMode(direction),
    lowY: layerTop - HEIGHT_UNIT,
    highY: layerTop
  };
}

function ringPointY(ring, point, slopeProfile) {
  if (!slopeProfile || slopeProfile.direction === 'none') return ring.y;
  const localHeight = slopeHeightFactor(point, slopeProfile.direction);
  return slopeProfile.lowY + (slopeProfile.highY - slopeProfile.lowY) * localHeight;
}

function slopeHeightFactor(point, direction) {
  if (direction === 'north') return clamp01(point.z + 0.5);
  if (direction === 'south') return clamp01(0.5 - point.z);
  if (direction === 'east') return clamp01(0.5 - point.x);
  if (direction === 'west') return clamp01(point.x + 0.5);
  return 1;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function materialIndexFor(cell) {
  const key = [
    normalizeTileSource(cell?.topSource, 'grass'),
    normalizeTileSource(cell?.sideSource, 'clay'),
    normalizeTileSource(cell?.bevelSource, 'grass'),
    normalizeTileSource(cell?.footSource, cell?.sideSource || 'clay')
  ].join('|');
  return MATERIAL_INDEX_BY_KEY.get(key) ?? 0;
}

function pushAtlasUv(uvs, materialIndex, face, point) {
  const cols = MATERIALS.length;
  const localU = face === FACE_SIDE
    ? clamp01(point.sideU ?? 0)
    : face === FACE_TOP
      ? clamp01(point.u ?? fract(point.x + 0.5))
      : clamp01(point.u ?? fract(point.x + 0.5));
  const localV = face === FACE_SIDE
    ? clamp01(point.sideV ?? 0)
    : face === FACE_TOP
      ? clamp01(point.v ?? fract(point.z + 0.5))
      : clamp01(point.v ?? fract(point.z + 0.5));
  uvs.push(
    (materialIndex + atlasTileLocal(localU)) / cols,
    (face + atlasTileLocal(localV)) / ATLAS_ROWS
  );
}

function atlasTileLocal(value) {
  const usable = ATLAS_TILE_SIZE - ATLAS_TEXEL_INSET * 2;
  return (ATLAS_TEXEL_INSET + clamp01(value) * usable) / ATLAS_TILE_SIZE;
}

function worldPoint(cellX, cellZ, local, y) {
  return {
    x: cellX + 0.5 + local.x,
    y,
    z: cellZ + 0.5 + local.z,
    u: clamp01(local.x + 0.5),
    v: clamp01(local.z + 0.5)
  };
}

function triangleNormal(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const n = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x
  };
  const length = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / length, y: n.y / length, z: n.z / length };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function fract(value) {
  return value - Math.floor(value);
}
