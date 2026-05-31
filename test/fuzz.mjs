import assert from 'node:assert';
import {
  canvasViewportWorldRect,
  canvasWheelZoomFactor,
  constrainCanvasCamera,
  hitTestCanvas,
  materializeCanvasFrame,
  materializeCanvasGrid,
  planCanvasFitBounds,
  planCanvasPan,
  planCanvasWheelZoom,
  planCanvasZoomAt,
  screenToWorld,
  selectCanvasItemsInRect,
  snapCanvasPoint,
  worldToScreen
} from '../dist/index.js';

const args = parseArgs(process.argv.slice(2));
const cases = readPositiveInt(args.cases, 500);
let seed = readPositiveInt(args.seed, 0x51ca5a11);
let checked = 0;

for (let i = 0; i < cases; i++) {
  const camera = {
    x: nextRange(-10000, 10000),
    y: nextRange(-10000, 10000),
    zoom: nextRange(0.05, 32),
    minZoom: 0.01,
    maxZoom: 64
  };
  const viewport = {
    width: nextRange(1, 3000),
    height: nextRange(1, 2000),
    left: nextRange(-50, 50),
    top: nextRange(-50, 50)
  };
  const screen = {
    x: nextRange(viewport.left, viewport.left + viewport.width),
    y: nextRange(viewport.top, viewport.top + viewport.height)
  };
  const world = screenToWorld(camera, viewport, screen);
  const roundTrip = worldToScreen(camera, viewport, world);
  assertClose(roundTrip.x, screen.x, 1e-9);
  assertClose(roundTrip.y, screen.y, 1e-9);

  const zoomFactor = nextRange(0.25, 4);
  const zoomPlan = planCanvasZoomAt({ camera, viewport, screen, factor: zoomFactor, now: i });
  const anchored = screenToWorld(zoomPlan.nextCamera, viewport, screen);
  assertClose(anchored.x, world.x, 1e-8);
  assertClose(anchored.y, world.y, 1e-8);
  const wheelFactor = canvasWheelZoomFactor({ wheelDelta: { x: 0, y: nextRange(-500, 500) } });
  assert.ok(Number.isFinite(wheelFactor) && wheelFactor > 0);
  const wheelPlan = planCanvasWheelZoom({
    camera,
    viewport,
    event: { type: 'wheel', screen, wheelDelta: { x: 0, y: nextRange(-500, 500) } },
    now: i
  });
  const wheelAnchored = screenToWorld(wheelPlan.nextCamera, viewport, screen);
  assertClose(wheelAnchored.x, world.x, 1e-8);
  assertClose(wheelAnchored.y, world.y, 1e-8);

  const panPlan = planCanvasPan({
    camera,
    deltaScreen: { x: nextRange(-500, 500), y: nextRange(-500, 500) },
    now: i
  });
  const expectedWorldDelta = {
    x: -(panPlan.patches.find((patch) => patch.path.endsWith('/x'))?.value - camera.x),
    y: -(panPlan.patches.find((patch) => patch.path.endsWith('/y'))?.value - camera.y)
  };
  assert.ok(Number.isFinite(expectedWorldDelta.x));
  assert.ok(Number.isFinite(expectedWorldDelta.y));
  const constraintBounds = {
    x: camera.x - nextRange(20, 200),
    y: camera.y - nextRange(20, 200),
    width: nextRange(250, 600),
    height: nextRange(250, 600)
  };
  const constrained = constrainCanvasCamera(
    { ...camera, x: constraintBounds.x - 1000, y: constraintBounds.y - 1000 },
    viewport,
    { bounds: constraintBounds, behavior: 'contain' }
  );
  const constrainedRect = canvasViewportWorldRect(constrained, viewport);
  assert.ok(Number.isFinite(constrained.x));
  assert.ok(Number.isFinite(constrained.y));
  assert.ok(Number.isFinite(constrainedRect.width));

  const fitBounds = {
    x: nextRange(-1000, 1000),
    y: nextRange(-1000, 1000),
    width: nextRange(1, 500),
    height: nextRange(1, 500)
  };
  const fitPlan = planCanvasFitBounds({ bounds: fitBounds, viewport, camera, padding: nextRange(0, 80), now: i });
  const fitRect = canvasViewportWorldRect(fitPlan.nextCamera, viewport);
  assert.ok(fitRect.width > 0 && fitRect.height > 0);
  assert.ok(fitPlan.patches.every((patch) => Number.isFinite(patch.value)));

  const grid = {
    enabled: true,
    size: nextRange(0.25, 128),
    subdivisions: 1 + nextInt(8),
    majorEvery: 1 + nextInt(8),
    snap: true,
    maxLines: 2000
  };
  const materialized = materializeCanvasGrid(camera, viewport, grid);
  assert.ok(materialized.vertical.length <= grid.maxLines);
  assert.ok(materialized.horizontal.length <= grid.maxLines);
  const snapped = snapCanvasPoint(world, grid);
  assertClose(snapped.x, Math.round(snapped.x / grid.size) * grid.size, Math.max(1e-8, grid.size * 1e-9));

  const item = {
    id: 'item-' + i,
    x: world.x - 1,
    y: world.y - 1,
    width: 2,
    height: 2,
    z: i % 5
  };
  const frame = materializeCanvasFrame({
    document: { items: [item] },
    session: { camera, viewport, selectedIds: [item.id], grid },
    now: i
  });
  assert.ok(frame.items.length <= 1);
  if (frame.items.length) {
    const hit = hitTestCanvas({ frame, point: screen, coordinate: 'screen', tolerance: 2 });
    assert.strictEqual(hit?.id, item.id);
    assert.deepStrictEqual(selectCanvasItemsInRect({
      frame,
      rect: { x: item.x, y: item.y, width: item.width, height: item.height },
      mode: 'contain'
    }), [item.id]);
  }
  const spatialFrame = materializeCanvasFrame({
    document: { items: [item] },
    session: { camera, viewport, selectedIds: [item.id], grid },
    spatialAdapter: {
      query(rect) {
        return item.x <= rect.x + rect.width &&
          item.x + item.width >= rect.x &&
          item.y <= rect.y + rect.height &&
          item.y + item.height >= rect.y ? [item] : [];
      }
    },
    now: i
  });
  assert.strictEqual(spatialFrame.items.length, frame.items.length);
  checked++;
}

console.log('frontier-canvas fuzz ok: ' + checked + ' cases');

function assertClose(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function nextRange(min, max) {
  return min + (next() / 0xffffffff) * (max - min);
}

function nextInt(max) {
  return next() % max;
}

function next() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cases') out.cases = argv[++i];
    else if (argv[i] === '--seed') out.seed = argv[++i];
  }
  return out;
}

function readPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
