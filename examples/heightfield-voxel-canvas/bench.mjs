import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  buildBlobMaskPolygonsFromPixels,
  buildTerrainMesh,
  cellKey,
  createInitialTerrain,
  normalizeHeight,
  parseCellKey,
  setBlobFramePolygons,
  terrainBounds
} from './src/mesh.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = readArgs(process.argv.slice(2));
const rounds = readInt(args.rounds, 12);
const size = readInt(args.size, 32);
const maxMs = args['max-ms'] === undefined ? null : Number(args['max-ms']);

configureInkwellMaskPolygons();

const fixtures = [
  { name: 'initial-mound', cells: createInitialTerrain(Math.max(4, Math.floor(size / 3))) },
  { name: 'terraced-field', cells: createTerracedField(size) },
  { name: 'blob-islands', cells: createBlobIslands(size) }
];

const results = [];
for (const fixture of fixtures) {
  const sample = buildTerrainMesh(fixture.cells);
  assertMesh(sample, fixture.name);
  const timings = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now();
    const mesh = buildTerrainMesh(fixture.cells);
    const elapsed = performance.now() - started;
    assertMesh(mesh, fixture.name);
    timings.push(elapsed);
  }
  timings.sort((a, b) => a - b);
  const mean = timings.reduce((sum, value) => sum + value, 0) / timings.length;
  const p95 = timings[Math.min(timings.length - 1, Math.floor(timings.length * 0.95))];
  const max = timings[timings.length - 1];
  const bounds = terrainBounds(fixture.cells);
  results.push({
    fixture: fixture.name,
    rounds,
    cells: sample.summary.cellCount,
    triangles: sample.summary.triangleCount,
    vertices: sample.summary.vertexCount,
    bounds,
    meanMs: round(mean),
    p95Ms: round(p95),
    maxMs: round(max)
  });
}

const report = {
  kind: 'frontier.canvas.heightfield-voxel.benchmark',
  version: 1,
  renderer: 'raw-webgl2',
  mesh: 'heightfield-face-construction',
  size,
  rounds,
  results
};

console.log(JSON.stringify(report, null, 2));

if (args.out) {
  const outPath = path.resolve(process.cwd(), String(args.out));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (maxMs !== null) {
  const slow = results.filter((result) => result.p95Ms > maxMs);
  if (slow.length) {
    console.error(`mesh benchmark exceeded p95 budget ${maxMs}ms: ${slow.map((result) => `${result.fixture}=${result.p95Ms}ms`).join(', ')}`);
    process.exit(1);
  }
}

function createTerracedField(width) {
  const cells = {};
  const radius = Math.floor(width / 2);
  for (let z = -radius; z < radius; z += 1) {
    for (let x = -radius; x < radius; x += 1) {
      const d = Math.hypot(x, z);
      if (d > radius * 0.95) continue;
      const band = Math.floor(d / Math.max(2, radius / 5));
      cells[cellKey(x, z)] = {
        height: normalizeHeight(1 + Math.max(0, 6 - band)),
        material: band % 3 === 0 ? 'grass' : band % 3 === 1 ? 'stone' : 'clay',
        shape: band % 2 === 0 ? 'boxy' : 'rounded',
        top: band % 3 === 0 ? 'beveled' : 'rounded'
      };
    }
  }
  return cells;
}

function createBlobIslands(width) {
  const cells = {};
  const radius = Math.floor(width / 2);
  for (let z = -radius; z < radius; z += 1) {
    for (let x = -radius; x < radius; x += 1) {
      const n = pseudoNoise(x, z);
      const ridge = Math.sin(x * 0.27) + Math.cos(z * 0.31) + n * 1.8;
      if (ridge < 0.12) continue;
      const parsed = parseCellKey(cellKey(x, z));
      cells[cellKey(parsed.x, parsed.z)] = {
        height: normalizeHeight(1 + Math.round(Math.min(9, ridge * 2.1))),
        material: ridge > 2.2 ? 'stone' : n > 0.48 ? 'clay' : 'grass',
        shape: n > 0.58 ? 'rounded' : 'boxy',
        top: ridge > 1.8 ? 'beveled' : 'rounded'
      };
    }
  }
  return cells;
}

function pseudoNoise(x, z) {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function assertMesh(mesh, fixture) {
  const vertexCount = mesh.positions.length / 3;
  assert(Number.isInteger(vertexCount), fixture + ': invalid position count');
  assert(mesh.normals.length === mesh.positions.length, fixture + ': normal count mismatch');
  assert(mesh.uvs.length === vertexCount * 2, fixture + ': uv count mismatch');
  assert(mesh.shades.length === vertexCount, fixture + ': shade count mismatch');
  assert(mesh.indices.length % 3 === 0, fixture + ': index count must be triangular');
  for (let i = 0; i < mesh.positions.length; i += 1) assert(Number.isFinite(mesh.positions[i]), fixture + ': non-finite position');
  for (let i = 0; i < mesh.normals.length; i += 1) assert(Number.isFinite(mesh.normals[i]), fixture + ': non-finite normal');
  for (let i = 0; i < mesh.uvs.length; i += 1) assert(Number.isFinite(mesh.uvs[i]), fixture + ': non-finite uv');
  for (let i = 0; i < mesh.shades.length; i += 1) assert(Number.isFinite(mesh.shades[i]), fixture + ': non-finite shade');
  for (let i = 0; i < mesh.indices.length; i += 1) {
    const index = mesh.indices[i];
    assert(index >= 0 && index < vertexCount, fixture + ': index out of range');
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function readInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function configureInkwellMaskPolygons() {
  for (const [style, filename] of [
    ['blob', 'grey-blob-mask.png'],
    ['curvy', 'grey-blob-mask-curvy.png']
  ]) {
    const png = PNG.sync.read(fs.readFileSync(path.resolve(__dirname, 'assets', filename)));
    setBlobFramePolygons(style, buildBlobMaskPolygonsFromPixels({
      width: png.width,
      height: png.height,
      data: png.data
    }, style === 'curvy'
      ? { simplifyTolerance: 0.046875, smooth: true }
      : { simplifyTolerance: 0.0625 }));
  }
}
