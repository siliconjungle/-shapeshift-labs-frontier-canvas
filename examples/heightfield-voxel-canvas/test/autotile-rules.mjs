import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  BLOB_RULE_SRC,
  blobFootprintPolygonForMask,
  blobFrameForMask,
  blobMaskForCells,
  blobMaskForCellsAtLayer,
  blobShapeProfileForMask,
  buildBlobMaskPolygonsFromPixels,
  buildBlobFrameLookup,
  buildTerrainMesh,
  canonicalBlobMaskForFrame,
  cellKey,
  ATLAS_ROWS,
  HEIGHT_UNIT,
  MATERIALS,
  setBlobFramePolygons,
  textureMaskForCellsAtLayer
} from '../src/mesh.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
configureInkwellMaskPolygons();

const INKWELL_RULE_SRC = {
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

const DIRS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1]
];

assert.deepEqual(BLOB_RULE_SRC, INKWELL_RULE_SRC, 'frontier demo blob rules must match Inkwell RULE_SRC');

const expectedLookup = buildBlobFrameLookup(INKWELL_RULE_SRC);
assert.equal(expectedLookup.length, 256);
for (let mask = 0; mask < 256; mask += 1) {
  assert.equal(blobFrameForMask(mask), expectedLookup[mask], `mask ${mask} must resolve to the Inkwell frame`);
}

for (const [frameText, masks] of Object.entries(INKWELL_RULE_SRC)) {
  const frame = Number(frameText);
  assert.equal(canonicalBlobMaskForFrame(frame), masks[0], `frame ${frame} must keep the Inkwell canonical mask`);
  const canonicalProfile = blobShapeProfileForMask(masks[0]);
  for (const mask of masks) {
    assert.deepEqual(blobShapeProfileForMask(mask), canonicalProfile, `mask ${mask} must share frame ${frame} profile`);
  }
}

assert.deepEqual(blobFootprintPolygonForMask(255, 'boxy'), [
  { x: -0.5, z: -0.5 },
  { x: 0.5, z: -0.5 },
  { x: 0.5, z: 0.5 },
  { x: -0.5, z: 0.5 }
], 'fully surrounded masks should keep a full shared square footprint');
assert(!polygonIncludesPoint(blobFootprintPolygonForMask(0, 'boxy'), -0.5, -0.5), 'isolated boxy masks should chamfer exposed outside corners');
assert(polygonIncludesPoint(blobFootprintPolygonForMask(2, 'boxy'), 0.5, -0.5), 'diagonal neighbors should back the matching corner instead of leaving a pinhole');
assert(
  blobFootprintPolygonForMask(0, 'rounded').length > blobFootprintPolygonForMask(0, 'boxy').length,
  'rounded blob masks should emit a visibly rounder outside-corner footprint than boxy masks'
);

for (let mask = 0; mask < 256; mask += 1) {
  const cells = cellsForMask(mask);
  assert.equal(blobMaskForCells(cells, 0, 0), mask, `cells for mask ${mask} must encode in Inkwell direction order`);
  assertFootprintMatchesMask(mask);
  assertMesh(buildTerrainMesh(cells), `mask ${mask}`);
}

assertLayerMasks();

let seed = 0x5eed1234;
for (let i = 0; i < 2000; i += 1) {
  const mask = randomByte();
  const cells = cellsForMask(mask, {
    height: 1 + (randomByte() % 8),
    material: ['grass', 'stone', 'clay'][randomByte() % 3],
    shape: ['boxy', 'rounded'][randomByte() % 2],
    top: ['flat', 'beveled', 'rounded'][randomByte() % 3]
  });
  assert.equal(blobMaskForCells(cells, 0, 0), mask, `fuzz mask ${mask} must round-trip`);
  assert.equal(blobFrameForMask(mask), expectedLookup[mask], `fuzz mask ${mask} frame mismatch`);
  assertMesh(buildTerrainMesh(cells), `fuzz mask ${mask}`);
}

console.log('heightfield autotile rule tests passed');

function configureInkwellMaskPolygons() {
  for (const [style, filename] of [
    ['blob', 'grey-blob-mask.png'],
    ['curvy', 'grey-blob-mask-curvy.png']
  ]) {
    const file = path.resolve(__dirname, '../assets', filename);
    const png = PNG.sync.read(fs.readFileSync(file));
    const polygons = buildBlobMaskPolygonsFromPixels({
      width: png.width,
      height: png.height,
      data: png.data
    }, style === 'curvy'
      ? { simplifyTolerance: 0.046875, smooth: true }
      : { simplifyTolerance: 0.0625 });
    assert.equal(polygons.length, 48, `${filename}: expected 48 mask frames`);
    assert(polygons.every((polygon) => polygon.length >= 3), `${filename}: every frame must produce a polygon`);
    assert(Math.max(...polygons.map((polygon) => polygon.length)) <= 18, `${filename}: coherent mesh polygons should stay simplified`);
    setBlobFramePolygons(style, polygons);
  }
}

function cellsForMask(mask, center = {}) {
  const cell = {
    height: center.height || 2,
    material: center.material || 'grass',
    shape: center.shape || 'boxy',
    top: center.top || 'beveled'
  };
  const cells = {
    [cellKey(0, 0)]: cell
  };
  for (let bit = 0; bit < DIRS.length; bit += 1) {
    if ((mask & (1 << bit)) === 0) continue;
    const [dx, dz] = DIRS[bit];
    cells[cellKey(dx, dz)] = {
      height: 1 + ((mask + bit) % 5),
      material: bit % 2 ? 'stone' : 'grass',
      shape: bit % 3 ? 'boxy' : 'rounded',
      top: bit % 2 ? 'beveled' : 'rounded'
    };
  }
  return cells;
}

function assertFootprintMatchesMask(mask) {
  const frame = blobFrameForMask(mask);
  const canonical = canonicalBlobMaskForFrame(frame);
  const canonicalPolygon = blobFootprintPolygonForMask(canonical, 'boxy');
  const polygon = blobFootprintPolygonForMask(mask, 'boxy');
  if ((mask & 0xaa) === (canonical & 0xaa)) {
    assert.deepEqual(polygon, canonicalPolygon, `mask ${mask} must use its canonical Inkwell frame footprint`);
  }
  const profile = blobShapeProfileForMask(mask);
  if (profile.n) assert(hasBoundaryEdge(polygon, 'north'), `mask ${mask}: north shared edge must be gap-free`);
  if (profile.e) assert(hasBoundaryEdge(polygon, 'east'), `mask ${mask}: east shared edge must be gap-free`);
  if (profile.s) assert(hasBoundaryEdge(polygon, 'south'), `mask ${mask}: south shared edge must be gap-free`);
  if (profile.w) assert(hasBoundaryEdge(polygon, 'west'), `mask ${mask}: west shared edge must be gap-free`);
}

function assertLayerMasks() {
  const cells = {
    [cellKey(0, 0)]: { height: 3, material: 'grass', shape: 'boxy', top: 'beveled' },
    [cellKey(0, -1)]: { height: 1, material: 'grass', shape: 'boxy', top: 'beveled' },
    [cellKey(1, 0)]: { height: 2, material: 'grass', shape: 'boxy', top: 'beveled' },
    [cellKey(0, 1)]: { height: 3, material: 'grass', shape: 'boxy', top: 'beveled' },
    [cellKey(-1, 0)]: { height: 1, material: 'grass', shape: 'boxy', top: 'beveled' }
  };
  assert.equal(blobMaskForCellsAtLayer(cells, 0, 0, 1), 1 | 4 | 16 | 64, 'layer 1 should connect all occupied lower neighbors');
  assert.equal(blobMaskForCellsAtLayer(cells, 0, 0, 2), 4 | 16, 'layer 2 should drop height-1 neighbors');
  assert.equal(blobMaskForCellsAtLayer(cells, 0, 0, 3), 16, 'layer 3 should only connect height-3 neighbors');
  assertMesh(buildTerrainMesh(cells), 'layered-mask-fixture');
  assertLayerRoofs();
  assertSlopeMesh();
  assertSideUvSlices();
  assertSideSkirtsTuckUnderTop();
  assertRoundedCornerGapFillers();
  assertRoundedCornerCaps();
  assertTopUvTileScale();
  assertFaceSourceAtlasColumns();
  assertDualTextureMasks();
  assertFootMaterialAtlasRow();
  assertHeightBreakShadeVariation();
}

function assertLayerRoofs() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 3, material: 'grass', shape: 'boxy', top: 'beveled' },
    [cellKey(1, 0)]: { height: 1, material: 'grass', shape: 'boxy', top: 'beveled' }
  });
  const roofLevels = upwardTriangleYLevels(mesh);
  for (const expected of [HEIGHT_UNIT, HEIGHT_UNIT * 3]) {
    assert(roofLevels.some((level) => Math.abs(level - expected) < 0.001), `expected a roof cap at layer y=${expected}`);
  }
  assert(
    !roofLevels.some((level) => Math.abs(level - HEIGHT_UNIT * 2) < 0.001),
    'fully covered intermediate layers should not emit visible roof caps'
  );
}

function assertSlopeMesh() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 3, material: 'grass', shape: 'full', top: 'flat', slope: 'east' }
  });
  assertMesh(mesh, 'slope-east-fixture');
  const slopeNormals = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    const normalY = mesh.normals[i * 3 + 1];
    const y = mesh.positions[i * 3 + 1];
    if (normalY > 0.25 && normalY < 0.9) {
      slopeNormals.push(normalY);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  assert(slopeNormals.length > 0, 'sloped cells should emit a non-flat roof normal');
  assert(minY <= HEIGHT_UNIT * 2 + 0.001, 'slope low edge should reach the previous height layer');
  assert(maxY >= HEIGHT_UNIT * 3 - 0.001, 'slope high edge should reach the selected height layer');
}

function assertSideUvSlices() {
  const rounded = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 2, material: 'grass', shape: 'rounded', top: 'rounded', slope: 'none' }
  });
  const full = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 2, material: 'grass', shape: 'full', top: 'flat', slope: 'none' }
  });
  const roundedSpans = sideUvSpans(rounded);
  const fullSpans = sideUvSpans(full);
  assert(fullSpans.some((span) => span > 0.78), 'full side edges should still use most of a tile');
  assert(roundedSpans.some((span) => span > 0.01 && span < 0.42), 'short rounded/chamfered side edges should use partial uv slices instead of stretching a full tile');
}

function assertSideSkirtsTuckUnderTop() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 1, material: 'grass', shape: 'full', top: 'flat', slope: 'none' }
  });
  let sideVertexCount = 0;
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    if (Math.abs(mesh.normals[i * 3 + 1]) > 0.1) continue;
    sideVertexCount += 1;
    const x = mesh.positions[i * 3];
    const z = mesh.positions[i * 3 + 2];
    assert(x >= -0.0001 && x <= 1.0001, `side skirt x should stay under the roof footprint, got ${x}`);
    assert(z >= -0.0001 && z <= 1.0001, `side skirt z should stay under the roof footprint, got ${z}`);
    assert(
      nearlyBoundary(x) || nearlyBoundary(z),
      `full-block side vertices should stay on shared footprint edges, got ${x},${z}`
    );
  }
  assert(sideVertexCount > 0, 'side skirt regression needs side vertices');
}

function nearlyBoundary(value) {
  return Math.abs(value) < 0.0001 || Math.abs(value - 1) < 0.0001;
}

function assertRoundedCornerGapFillers() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 1, material: 'grass', shape: 'rounded', top: 'rounded', slope: 'none' }
  });
  const expectedCorners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ];
  for (const [expectedX, expectedZ] of expectedCorners) {
    const found = sideVertexPositions(mesh).some(([x, y, z]) =>
      Math.abs(x - expectedX) < 0.0001 &&
      Math.abs(z - expectedZ) < 0.0001 &&
      y > HEIGHT_UNIT - 0.001
    );
    assert(found, `rounded corner side filler should cover ${expectedX},${expectedZ}`);
  }
}

function assertRoundedCornerCaps() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 1, material: 'grass', shape: 'rounded', top: 'rounded', slope: 'none' }
  });
  const expectedCorners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ];
  for (const [expectedX, expectedZ] of expectedCorners) {
    const found = upwardVertexPositions(mesh).some(([x, y, z]) =>
      Math.abs(x - expectedX) < 0.0001 &&
      Math.abs(z - expectedZ) < 0.0001 &&
      Math.abs(y - HEIGHT_UNIT) < 0.001
    );
    assert(found, `rounded corner cap should cover top seam at ${expectedX},${expectedZ}`);
  }
}

function sideVertexPositions(mesh) {
  const out = [];
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    if (Math.abs(mesh.normals[i * 3 + 1]) > 0.1) continue;
    out.push([
      mesh.positions[i * 3],
      mesh.positions[i * 3 + 1],
      mesh.positions[i * 3 + 2]
    ]);
  }
  return out;
}

function upwardVertexPositions(mesh) {
  const out = [];
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    if (mesh.normals[i * 3 + 1] < 0.98) continue;
    out.push([
      mesh.positions[i * 3],
      mesh.positions[i * 3 + 1],
      mesh.positions[i * 3 + 2]
    ]);
  }
  return out;
}

function assertTopUvTileScale() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 1, material: 'grass', shape: 'full', top: 'flat', slope: 'none' }
  });
  const us = [];
  const vs = [];
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    if (mesh.normals[i * 3 + 1] < 0.98) continue;
    const y = mesh.positions[i * 3 + 1];
    if (Math.abs(y - HEIGHT_UNIT) > 0.001) continue;
    const u = mesh.uvs[i * 2];
    const v = mesh.uvs[i * 2 + 1];
    if (v >= 1 / ATLAS_ROWS) continue;
    us.push(atlasLocalU(u));
    vs.push(v * ATLAS_ROWS);
  }
  assert(us.length > 0, 'top UV tile-scale fixture should include final top vertices');
  assert(Math.max(...us) - Math.min(...us) > 0.85, 'flat top should use most of the source tile width instead of stretching one texel band');
  assert(Math.max(...vs) - Math.min(...vs) > 0.85, 'flat top should use most of the source tile height instead of stretching one texel band');
}

function assertFaceSourceAtlasColumns() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: {
      height: 1,
      baseTopSource: 'grass',
      topSource: 'stone',
      sideSource: 'clay',
      bevelSource: 'grass',
      footSource: 'stone',
      shape: 'full',
      textureShape: 'rounded',
      top: 'flat',
      slope: 'none'
    }
  });
  const column = MATERIALS.indexOf('stone|clay|grass|stone');
  assert(column >= 0, 'expected atlas column for explicit top/wall/bevel sources');
  let foundExplicitNonTop = false;
  for (let i = 0; i < mesh.uvs.length; i += 2) {
    const row = Math.floor(mesh.uvs[i + 1] * ATLAS_ROWS);
    if (row === 0) continue; // top overlays can intentionally use their base source column first.
    if (Math.floor(mesh.uvs[i] * MATERIALS.length) === column) foundExplicitNonTop = true;
  }
  assert(foundExplicitNonTop, 'explicit side/lip/foot sources should map to their atlas column');
}

function assertDualTextureMasks() {
  const cells = {
    [cellKey(0, 0)]: { height: 1, baseTopSource: 'grass', topSource: 'stone', sideSource: 'clay', bevelSource: 'grass', footSource: 'clay', shape: 'full', textureShape: 'rounded', top: 'flat' },
    [cellKey(1, 0)]: { height: 1, baseTopSource: 'grass', topSource: 'stone', sideSource: 'clay', bevelSource: 'grass', footSource: 'clay', shape: 'full', textureShape: 'rounded', top: 'flat' },
    [cellKey(0, 1)]: { height: 1, baseTopSource: 'grass', topSource: 'grass', sideSource: 'clay', bevelSource: 'grass', footSource: 'clay', shape: 'full', textureShape: 'rounded', top: 'flat' },
    [cellKey(-1, 0)]: { height: 1, baseTopSource: 'grass', topSource: 'stone', sideSource: 'stone', bevelSource: 'stone', footSource: 'stone', shape: 'rounded', textureShape: 'boxy', top: 'rounded' }
  };
  assert.equal(blobMaskForCellsAtLayer(cells, 0, 0, 1), 4 | 16 | 64, 'shape mask should follow height occupancy regardless of material');
  assert.equal(textureMaskForCellsAtLayer(cells, 0, 0, 1), 4, 'texture mask should follow same surface intent rather than all occupied neighbors');
  assertMesh(buildTerrainMesh(cells), 'dual-texture-mask-fixture');
}

function assertFootMaterialAtlasRow() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: {
      height: 1,
      topSource: 'grass',
      sideSource: 'clay',
      bevelSource: 'grass',
      footSource: 'stone',
      shape: 'full',
      top: 'flat',
      slope: 'none'
    }
  });
  let foundFoot = false;
  for (let i = 0; i < mesh.uvs.length; i += 2) {
    const row = Math.floor(mesh.uvs[i + 1] * ATLAS_ROWS);
    if (row === 3) foundFoot = true;
  }
  assert(foundFoot, 'wall mesh should include a dedicated foot/contact material row');
}

function assertHeightBreakShadeVariation() {
  const mesh = buildTerrainMesh({
    [cellKey(0, 0)]: { height: 3, material: 'grass', shape: 'full', top: 'flat', slope: 'none' },
    [cellKey(1, 0)]: { height: 1, material: 'grass', shape: 'full', top: 'flat', slope: 'none' },
    [cellKey(0, 1)]: { height: 3, material: 'grass', shape: 'full', top: 'flat', slope: 'none' }
  });
  const topShades = [];
  for (let i = 0; i < mesh.positions.length / 3; i += 1) {
    if (mesh.normals[i * 3 + 1] < 0.98) continue;
    const y = mesh.positions[i * 3 + 1];
    if (Math.abs(y - HEIGHT_UNIT * 3) > 0.001) continue;
    topShades.push(mesh.shades[i]);
  }
  assert(topShades.length > 0, 'height-break fixture should emit final top vertices');
  assert(Math.max(...topShades) - Math.min(...topShades) > 0.025, 'height breaks should produce per-vertex top shade variation');
}

function sideUvSpans(mesh) {
  const spans = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    const localVs = ids.map((id) => mesh.uvs[id * 2 + 1] * ATLAS_ROWS);
    if (!localVs.every((value) => value > 2 && value < 3)) continue;
    const localUs = ids.map((id) => atlasLocalU(mesh.uvs[id * 2]));
    spans.push(Math.max(...localUs) - Math.min(...localUs));
  }
  return spans;
}

function atlasLocalU(value) {
  const scaled = value * MATERIALS.length;
  return scaled - Math.floor(scaled);
}

function hasBoundaryEdge(polygon, side) {
  const expected = {
    north: [{ x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 }],
    east: [{ x: 0.5, z: -0.5 }, { x: 0.5, z: 0.5 }],
    south: [{ x: 0.5, z: 0.5 }, { x: -0.5, z: 0.5 }],
    west: [{ x: -0.5, z: 0.5 }, { x: -0.5, z: -0.5 }]
  }[side];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (pointsEqual(a, expected[0]) && pointsEqual(b, expected[1])) return true;
  }
  return false;
}

function polygonIncludesPoint(polygon, x, z) {
  return polygon.some((point) => Math.abs(point.x - x) < 0.0001 && Math.abs(point.z - z) < 0.0001);
}

function pointsEqual(a, b) {
  return Math.abs(a.x - b.x) < 0.0001 && Math.abs(a.z - b.z) < 0.0001;
}

function upwardTriangleYLevels(mesh) {
  const levels = new Set();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ia = mesh.indices[i];
    const ib = mesh.indices[i + 1];
    const ic = mesh.indices[i + 2];
    const normalY = (mesh.normals[ia * 3 + 1] + mesh.normals[ib * 3 + 1] + mesh.normals[ic * 3 + 1]) / 3;
    if (normalY < 0.98) continue;
    const y = (mesh.positions[ia * 3 + 1] + mesh.positions[ib * 3 + 1] + mesh.positions[ic * 3 + 1]) / 3;
    levels.add(Math.round(y * 1000) / 1000);
  }
  return Array.from(levels);
}

function assertMesh(mesh, label) {
  const vertexCount = mesh.positions.length / 3;
  assert(vertexCount > 0, `${label}: expected vertices`);
  assert.equal(mesh.normals.length, mesh.positions.length, `${label}: normal count mismatch`);
  assert.equal(mesh.uvs.length, vertexCount * 2, `${label}: uv count mismatch`);
  assert.equal(mesh.shades.length, vertexCount, `${label}: shade count mismatch`);
  assert.equal(mesh.indices.length % 3, 0, `${label}: triangle index count mismatch`);
  for (const value of mesh.positions) assert(Number.isFinite(value), `${label}: non-finite position`);
  for (const value of mesh.normals) assert(Number.isFinite(value), `${label}: non-finite normal`);
  for (const value of mesh.uvs) assert(Number.isFinite(value), `${label}: non-finite uv`);
  for (const value of mesh.shades) assert(Number.isFinite(value), `${label}: non-finite shade`);
  for (const index of mesh.indices) assert(index >= 0 && index < vertexCount, `${label}: index out of range`);
  for (let i = 0; i < mesh.uvs.length; i += 2) {
    assertAtlasSafeUv(mesh.uvs[i], `${label}: unsafe atlas u at vertex ${i / 2}`);
    assertAtlasSafeUv(mesh.uvs[i + 1], `${label}: unsafe atlas v at vertex ${i / 2}`);
  }
}

function randomByte() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed >>> 16) & 255;
}

function assertAtlasSafeUv(value, label) {
  assert(value > 0 && value < 1, `${label}: expected uv inside atlas bounds, got ${value}`);
  const seams = [];
  if (label.includes(' u ')) {
    for (let i = 1; i < MATERIALS.length; i += 1) seams.push(i / MATERIALS.length);
  } else {
    for (let i = 1; i < ATLAS_ROWS; i += 1) seams.push(i / ATLAS_ROWS);
  }
  const tolerance = Math.min(0.0009, 0.25 / (MATERIALS.length * 128));
  for (const seam of seams) {
    assert(Math.abs(value - seam) > tolerance, `${label}: uv landed on atlas seam ${seam}`);
  }
}
