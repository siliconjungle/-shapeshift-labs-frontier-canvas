import assert from 'node:assert';
import {
  canvasViewportWorldRect,
  canvasWheelZoomFactor,
  classifyCanvasStatePath,
  constrainCanvasCamera,
  createCanvasStateLayoutForSurface,
  createMarqueeSelectCanvasTool,
  createCanvasProof,
  createCanvasRegistryGraph,
  createCanvasSurface,
  createCanvasToolRegistry,
  createPanCanvasTool,
  createSelectCanvasTool,
  createZoomCanvasTool,
  decodeCanvasJsonl,
  dispatchCanvasTool,
  encodeCanvasJsonl,
  hitTestCanvas,
  materializeCanvasFrame,
  materializeCanvasGrid,
  planCanvasFitBounds,
  planCanvasPan,
  planCanvasWheelZoom,
  planCanvasZoomAt,
  partitionCanvasPatches,
  redactCanvasValue,
  screenToWorld,
  selectCanvasItemsInRect,
  snapCanvasPoint,
  traceCanvasImpact,
  worldToScreen
} from '../dist/index.js';

const surface = createCanvasSurface({
  id: 'level-editor.canvas',
  package: '@game/editor',
  feature: 'level-editor',
  owner: '@team/tools',
  statePath: '/editor/canvas',
  document: {
    id: 'level-1',
    layers: [
      { id: 'background', order: 0 },
      { id: 'entities', order: 10 }
    ],
    items: [
      { id: 'node:a', x: 10, y: 12, width: 4, height: 2, layer: 'entities', z: 1, tags: ['npc'] },
      { id: 'node:b', x: -50, y: -50, width: 3, height: 3, layer: 'background', z: 0 },
      { id: 'node:hidden', x: 0, y: 0, width: 1, height: 1, visible: false }
    ]
  },
  session: {
    camera: { x: 8, y: 10, zoom: 20 },
    viewport: { width: 400, height: 240 },
    grid: { enabled: true, size: 1, subdivisions: 2, snap: true },
    selectedIds: ['node:a'],
    activeToolId: 'canvas.select'
  },
  tools: [
    createSelectCanvasTool(),
    createMarqueeSelectCanvasTool({ selectionPath: '/editor/canvas/session/selectedIds' }),
    createPanCanvasTool({ cameraPath: '/editor/canvas/session/camera' }),
    createZoomCanvasTool({ cameraPath: '/editor/canvas/session/camera' })
  ],
  metadata: { apiKey: 'secret' }
});

assert.strictEqual(surface.summary.itemCount, 3);
assert.strictEqual(surface.summary.toolCount, 4);

const stateLayout = createCanvasStateLayoutForSurface(surface);
assert.strictEqual(classifyCanvasStatePath('/editor/canvas/document/items/node:a/x', stateLayout).scope, 'crdt');
assert.strictEqual(classifyCanvasStatePath('/editor/canvas/session/camera/x', stateLayout).scope, 'local');
let partition = partitionCanvasPatches([
  { op: 'set', path: '/editor/canvas/document/items/node:a/x', value: 12 },
  { op: 'set', path: '/editor/canvas/session/camera/x', value: 9 }
], stateLayout);
assert.deepStrictEqual(partition.crdt.map((patch) => patch.path), ['/editor/canvas/document/items/node:a/x']);
assert.deepStrictEqual(partition.local.map((patch) => patch.path), ['/editor/canvas/session/camera/x']);
const sharedSessionLayout = createCanvasStateLayoutForSurface(surface, { scopes: { session: 'crdt' } });
assert.strictEqual(classifyCanvasStatePath('/editor/canvas/session/camera/x', sharedSessionLayout).scope, 'crdt');
const localDocumentLayout = createCanvasStateLayoutForSurface(surface, { scopes: { document: 'local' } });
assert.strictEqual(classifyCanvasStatePath('/editor/canvas/document/items/node:a/x', localDocumentLayout).scope, 'local');

const world = screenToWorld(surface.session.camera, surface.session.viewport, { x: 40, y: 40 });
assert.deepStrictEqual(world, { x: 10, y: 12 });
assert.deepStrictEqual(worldToScreen(surface.session.camera, surface.session.viewport, world), { x: 40, y: 40 });
assert.deepStrictEqual(canvasViewportWorldRect(surface.session.camera, surface.session.viewport), {
  x: 8,
  y: 10,
  width: 20,
  height: 12
});

const zoomPlan = planCanvasZoomAt({
  camera: surface.session.camera,
  viewport: surface.session.viewport,
  screen: { x: 40, y: 40 },
  factor: 2,
  now: 1000,
  cameraPath: '/editor/canvas/session/camera'
});
assert.strictEqual(zoomPlan.nextCamera.zoom, 40);
assert.deepStrictEqual(screenToWorld(zoomPlan.nextCamera, surface.session.viewport, { x: 40, y: 40 }), world);
assert.ok(zoomPlan.patches.some((patch) => patch.path === '/editor/canvas/session/camera/zoom'));
assert.ok(canvasWheelZoomFactor({ wheelDelta: { x: 0, y: -100 } }) > 1);
const wheelPlan = planCanvasWheelZoom({
  camera: surface.session.camera,
  viewport: surface.session.viewport,
  event: { type: 'wheel', screen: { x: 40, y: 40 }, wheelDelta: { x: 0, y: -100 } },
  cameraPath: '/editor/canvas/session/camera',
  now: 1001
});
assert.ok(wheelPlan.nextCamera.zoom > surface.session.camera.zoom);
assert.deepStrictEqual(screenToWorld(wheelPlan.nextCamera, surface.session.viewport, { x: 40, y: 40 }), world);

let clock = 2000;
const timestampPlan = planCanvasZoomAt({
  camera: surface.session.camera,
  viewport: surface.session.viewport,
  screen: { x: 40, y: 40 },
  factor: 1,
  now: () => clock++
});
assert.strictEqual(timestampPlan.createdAt, 2000);
assert.strictEqual(clock, 2001);

const panPlan = planCanvasPan({
  camera: surface.session.camera,
  deltaScreen: { x: 20, y: -40 },
  now: 1000
});
assert.deepStrictEqual(panPlan.worldDelta, { x: -1, y: 2 });
assert.strictEqual(panPlan.nextCamera.x, 7);
assert.strictEqual(panPlan.nextCamera.y, 12);
const constrained = constrainCanvasCamera(
  { x: -100, y: -100, zoom: 2 },
  { width: 100, height: 100 },
  { bounds: { x: 0, y: 0, width: 200, height: 200 }, behavior: 'contain' }
);
assert.deepStrictEqual({ x: constrained.x, y: constrained.y }, { x: 0, y: 0 });
const fitPlan = planCanvasFitBounds({
  bounds: { x: 10, y: 20, width: 100, height: 50 },
  viewport: { width: 400, height: 200 },
  camera: { x: 0, y: 0, zoom: 1 },
  padding: 20,
  now: 1002
});
assert.strictEqual(fitPlan.nextCamera.zoom, 3.2);
assert.deepStrictEqual(canvasViewportWorldRect(fitPlan.nextCamera, { width: 400, height: 200 }), {
  x: -2.5,
  y: 13.75,
  width: 125,
  height: 62.5
});

const grid = materializeCanvasGrid(surface.session.camera, surface.session.viewport, surface.session.grid);
assert.strictEqual(grid.enabled, true);
assert.ok(grid.vertical.length > 0);
assert.ok(grid.horizontal.some((line) => line.major));
assert.deepStrictEqual(snapCanvasPoint({ x: 1.2, y: 1.8 }, surface.session.grid), { x: 1, y: 2 });

const frame = materializeCanvasFrame({ surface, now: 1100 });
assert.strictEqual(frame.summary.visibleItemCount, 1);
assert.strictEqual(frame.items[0].id, 'node:a');
assert.strictEqual(frame.handles.length, 4);
assert.strictEqual(hitTestCanvas({ frame, point: { x: 45, y: 45 }, coordinate: 'screen' }).id, 'node:a');
assert.deepStrictEqual(selectCanvasItemsInRect({
  frame,
  rect: { x: 9, y: 11, width: 10, height: 10 },
  mode: 'contain'
}), ['node:a']);
const spatialFrame = materializeCanvasFrame({
  surface,
  spatialAdapter: {
    query(rect) {
      return surface.document.items.filter((item) =>
        item.x <= rect.x + rect.width &&
        item.x + item.width >= rect.x &&
        item.y <= rect.y + rect.height &&
        item.y + item.height >= rect.y
      );
    }
  },
  now: 1101
});
assert.deepStrictEqual(spatialFrame.items.map((item) => item.id), frame.items.map((item) => item.id));
assert.strictEqual(hitTestCanvas({
  items: [
    { id: 'far', x: 0, y: 0, width: 100, height: 100, z: 1 },
    { id: 'near', x: 30, y: 30, width: 20, height: 20, z: 1 }
  ],
  point: { x: 40, y: 40 }
}).id, 'near');
assert.strictEqual(hitTestCanvas({
  items: [{
    id: 'ellipse',
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    hitArea: { kind: 'ellipse' }
  }],
  point: { x: 10, y: 5 }
}).id, 'ellipse');
assert.strictEqual(hitTestCanvas({
  items: [{
    id: 'ellipse',
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    hitArea: { kind: 'ellipse' }
  }],
  point: { x: 0, y: 0 }
}), null);

const registry = createCanvasToolRegistry({
  activeToolId: 'canvas.select',
  tools: surface.tools
});
const selectRecord = dispatchCanvasTool(registry, {
  event: { type: 'pointerdown', screen: { x: 45, y: 45 } },
  context: {
    surface,
    document: surface.document,
    session: surface.session,
    camera: surface.session.camera,
    viewport: surface.session.viewport,
    frame
  },
  now: 1200
});
assert.strictEqual(selectRecord.status, 'ok');
assert.deepStrictEqual(selectRecord.patches, [{ op: 'set', path: '/canvas/session/selectedIds', value: ['node:a'] }]);

registry.activeToolId = 'canvas.zoom';
const zoomRecord = registry.dispatch({
  event: { type: 'wheel', screen: { x: 40, y: 40 }, wheelDelta: { x: 0, y: -100 } },
  context: {
    surface,
    session: surface.session,
    camera: surface.session.camera,
    viewport: surface.session.viewport,
    frame
  },
  now: 1210
});
assert.strictEqual(zoomRecord.status, 'ok');
assert.ok(zoomRecord.patches.some((patch) => patch.path === '/editor/canvas/session/camera/zoom'));

registry.activeToolId = 'canvas.marqueeSelect';
const marqueeRecord = registry.dispatch({
  event: { type: 'pointerup', startScreen: { x: 20, y: 20 }, screen: { x: 120, y: 100 } },
  context: {
    surface,
    session: surface.session,
    camera: surface.session.camera,
    viewport: surface.session.viewport,
    frame
  },
  now: 1220
});
assert.deepStrictEqual(marqueeRecord.patches, [{ op: 'set', path: '/editor/canvas/session/selectedIds', value: ['node:a'] }]);

const constrainedPanRegistry = createCanvasToolRegistry({
  activeToolId: 'canvas.pan',
  tools: [createPanCanvasTool({
    cameraPath: '/editor/canvas/session/camera',
    constraints: { bounds: { x: 0, y: 0, width: 200, height: 200 }, behavior: 'contain' }
  })]
});
const constrainedPanRecord = constrainedPanRegistry.dispatch({
  event: { type: 'pointermove', previousScreen: { x: 0, y: 0 }, screen: { x: 10000, y: 10000 } },
  context: {
    session: surface.session,
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 100, height: 100 },
    frame
  },
  now: 1230
});
assert.strictEqual(constrainedPanRecord.plans[0].nextCamera.x, 0);
assert.strictEqual(constrainedPanRecord.plans[0].nextCamera.y, 0);

registry.register({
  id: 'canvas.measure',
  title: 'Measure',
  events: ['pointerdown', 'keydown'],
  reads: ['/editor/canvas/document/items'],
  handlers: {
    pointerdown(context, event) {
      return {
        patches: [{
          op: 'set',
          path: '/editor/canvas/session/measureStart',
          value: event.world ?? screenToWorld(context.camera, context.viewport, event.screen ?? { x: 0, y: 0 })
        }]
      };
    }
  }
});
assert.ok(registry.get('canvas.measure').events.includes('pointerdown'));
assert.ok(registry.get('canvas.measure').events.includes('keydown'));
registry.activeToolId = 'canvas.measure';
const measureRecord = registry.dispatch({
  event: { type: 'pointerdown', screen: { x: 40, y: 40 } },
  context: {
    session: surface.session,
    camera: surface.session.camera,
    viewport: surface.session.viewport,
    frame
  },
  now: 1300
});
assert.strictEqual(measureRecord.toolId, 'canvas.measure');
assert.strictEqual(measureRecord.patches[0].path, '/editor/canvas/session/measureStart');

const graph = createCanvasRegistryGraph(surface, { generatedAt: 1400 });
assert.ok(graph.entries.some((entry) => entry.id === 'canvas:level-editor.canvas'));
assert.ok(graph.entries.some((entry) => entry.id === 'canvas-tool:canvas.select'));
assert.ok(graph.edges.some((edge) => edge.kind === 'exposes'));

const impact = traceCanvasImpact(surface, { paths: ['/editor/canvas/session/camera'] });
assert.ok(impact.surfaceIds.includes('level-editor.canvas'));
assert.ok(impact.toolIds.includes('canvas.pan'));
const itemImpact = traceCanvasImpact(surface, { ids: ['node:a'] });
assert.deepStrictEqual(itemImpact.itemIds, ['node:a']);

const jsonl = encodeCanvasJsonl([frame, selectRecord]);
assert.strictEqual(decodeCanvasJsonl(jsonl).length, 2);
assert.notStrictEqual(createCanvasProof(surface, { generatedAt: 1 }).hash.length, 0);
assert.strictEqual(JSON.stringify(redactCanvasValue(surface)).includes('secret'), false);
