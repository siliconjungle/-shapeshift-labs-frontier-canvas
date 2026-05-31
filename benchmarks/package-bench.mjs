import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  constrainCanvasCamera,
  createMarqueeSelectCanvasTool,
  createCanvasProof,
  createCanvasRegistryGraph,
  createCanvasSurface,
  createCanvasToolRegistry,
  createPanCanvasTool,
  createSelectCanvasTool,
  createZoomCanvasTool,
  hitTestCanvas,
  materializeCanvasFrame,
  materializeCanvasGrid,
  planCanvasFitBounds,
  planCanvasPan,
  planCanvasWheelZoom,
  planCanvasZoomAt,
  selectCanvasItemsInRect,
  traceCanvasImpact
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const repoRoot = path.basename(path.dirname(packageDir)) === 'packages'
  ? path.resolve(packageDir, '..', '..')
  : packageDir;
const args = parseArgs(process.argv.slice(2));
const itemCount = readPositiveInt(args.items, 10000);
const rounds = readPositiveInt(args.rounds, 30);
const outPath = args.out ? path.resolve(repoRoot, args.out) : null;

const surfaceInput = makeSurfaceInput(itemCount);
let surface = createCanvasSurface(surfaceInput);
let frame = materializeCanvasFrame({ surface, now: 1 });
const registry = createCanvasToolRegistry({ tools: surface.tools, activeToolId: 'canvas.select' });
let cursor = 0;

const rows = [
  measure('create-surface-' + itemCount, 1, () => {
    surface = createCanvasSurface(surfaceInput);
    return surface.summary.itemCount;
  }),
  measure('materialize-frame-' + itemCount, 8, () => {
    frame = materializeCanvasFrame({ surface, now: cursor++ });
    return frame.summary.visibleItemCount;
  }),
  measure('materialize-grid', 256, () => materializeCanvasGrid(surface.session.camera, surface.session.viewport, surface.session.grid).vertical.length),
  measure('hit-test-visible', 256, () => hitTestCanvas({ frame, point: { x: 440, y: 320 }, coordinate: 'screen', tolerance: 4 }) ? 1 : 0),
  measure('plan-pan', 512, () => planCanvasPan({ camera: surface.session.camera, deltaScreen: { x: 12, y: -8 }, now: cursor++ }).patches.length),
  measure('plan-zoom-at', 512, () => planCanvasZoomAt({ camera: surface.session.camera, viewport: surface.session.viewport, screen: { x: 320, y: 220 }, factor: 1.08, now: cursor++ }).patches.length),
  measure('plan-wheel-zoom', 512, () => planCanvasWheelZoom({
    camera: surface.session.camera,
    viewport: surface.session.viewport,
    event: { type: 'wheel', screen: { x: 320, y: 220 }, wheelDelta: { x: 0, y: -120 } },
    now: cursor++
  }).patches.length),
  measure('plan-fit-bounds', 512, () => planCanvasFitBounds({
    bounds: { x: 100, y: 200, width: 600, height: 320 },
    viewport: surface.session.viewport,
    camera: surface.session.camera,
    padding: 24,
    now: cursor++
  }).patches.length),
  measure('constrain-camera', 512, () => constrainCanvasCamera(
    { ...surface.session.camera, x: -1000, y: -1000 },
    surface.session.viewport,
    { bounds: { x: 0, y: 0, width: 2000, height: 2000 }, behavior: 'contain' }
  ).x),
  measure('select-rect-visible', 128, () => selectCanvasItemsInRect({
    frame,
    rect: frame.worldRect,
    selectableOnly: true
  }).length),
  measure('dispatch-select-tool', 128, () => registry.dispatch({
    toolId: 'canvas.select',
    event: { type: 'pointerdown', screen: { x: 440, y: 320 } },
    context: { surface, session: surface.session, camera: surface.session.camera, viewport: surface.session.viewport, frame },
    now: cursor++
  }).patches.length),
  measure('dispatch-wheel-tool', 128, () => registry.dispatch({
    toolId: 'canvas.zoom',
    event: { type: 'wheel', screen: { x: 440, y: 320 }, wheelDelta: { x: 0, y: -120 } },
    context: { surface, session: surface.session, camera: surface.session.camera, viewport: surface.session.viewport, frame },
    now: cursor++
  }).patches.length),
  measure('dispatch-marquee-tool', 128, () => registry.dispatch({
    toolId: 'canvas.marqueeSelect',
    event: { type: 'pointerup', startScreen: { x: 0, y: 0 }, screen: { x: 1280, y: 720 } },
    context: { surface, session: surface.session, camera: surface.session.camera, viewport: surface.session.viewport, frame },
    now: cursor++
  }).patches.length),
  measure('registry-graph', 4, () => createCanvasRegistryGraph(surface).entries.length),
  measure('trace-impact', 16, () => traceCanvasImpact(surface, { paths: ['/canvas/session/camera'] }).toolIds.length),
  measure('proof', 16, () => createCanvasProof(surface, { generatedAt: 1 }).hash.length)
];

const report = {
  package: '@shapeshift-labs/frontier-canvas',
  version: readPackageVersion(),
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform + ' ' + process.arch,
  itemCount,
  rounds,
  rows
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
}

console.log(report.package + ' package benchmark');
console.log('Node ' + report.node + ' on ' + report.platform + ', items=' + itemCount + ', rounds=' + rounds);
console.log('These are Frontier-only package measurements, not competitor comparisons.');
console.log('');
console.log(padRight('Fixture', 32) + padLeft('Median', 12) + padLeft('p95', 12));
for (const row of rows) {
  console.log(padRight(row.fixture, 32) + padLeft(formatUs(row.medianUs), 12) + padLeft(formatUs(row.p95Us), 12));
}
if (outPath) console.log('\nwrote ' + path.relative(repoRoot, outPath));

function makeSurfaceInput(count) {
  const items = [];
  const columns = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const x = (i % columns) * 8;
    const y = Math.floor(i / columns) * 6;
    items.push({
      id: 'node:' + i,
      x,
      y,
      width: 4,
      height: 3,
      layer: i % 3 === 0 ? 'notes' : 'shapes',
      z: i % 17,
      tags: [i % 2 === 0 ? 'even' : 'odd']
    });
  }
  return {
    id: 'bench.canvas',
    statePath: '/canvas',
    document: {
      layers: [
        { id: 'notes', order: 1 },
        { id: 'shapes', order: 2 }
      ],
      items
    },
    session: {
      camera: { x: 0, y: 0, zoom: 2 },
      viewport: { width: 1280, height: 720 },
      grid: { enabled: true, size: 16, subdivisions: 4, majorEvery: 4 },
      selectedIds: ['node:10']
    },
    tools: [createSelectCanvasTool(), createMarqueeSelectCanvasTool(), createPanCanvasTool(), createZoomCanvasTool()]
  };
}

function measure(fixture, batchSize, fn) {
  const values = [];
  let sink = 0;
  for (let round = 0; round < rounds; round++) {
    const started = performance.now();
    for (let i = 0; i < batchSize; i++) sink += fn();
    values[values.length] = ((performance.now() - started) * 1000) / batchSize;
  }
  if (sink === -1) console.log('sink=' + sink);
  values.sort((left, right) => left - right);
  return {
    fixture,
    medianUs: percentile(values, 0.5),
    p95Us: percentile(values, 0.95)
  };
}

function percentile(values, p) {
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))] ?? 0;
}

function formatUs(value) {
  if (value >= 1000) return (value / 1000).toFixed(2) + ' ms';
  return value.toFixed(2) + ' us';
}

function padRight(value, width) {
  return String(value).padEnd(width, ' ');
}

function padLeft(value, width) {
  return String(value).padStart(width, ' ');
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).version;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--items') out.items = argv[++i];
    else if (arg === '--rounds') out.rounds = argv[++i];
    else if (arg === '--out') out.out = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run bench -- [--items 10000] [--rounds 30] [--out benchmarks/results/frontier-canvas-package-bench-latest.json]');
      process.exit(0);
    }
  }
  return out;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
