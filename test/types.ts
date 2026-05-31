import {
  createMarqueeSelectCanvasTool,
  createCanvasSurface,
  createCanvasToolRegistry,
  createZoomCanvasTool,
  materializeCanvasFrame,
  planCanvasFitBounds,
  selectCanvasItemsInRect,
  type FrontierCanvasFrame,
  type FrontierCanvasPlan,
  type FrontierCanvasSurface,
  type FrontierCanvasTool
} from '../dist/index.js';

const surface: FrontierCanvasSurface = createCanvasSurface({
  id: 'types.canvas',
  document: {
    items: [{ id: 'node:1', x: 0, y: 0, width: 10, height: 10 }]
  },
  session: {
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 100, height: 100 }
  },
  tools: [{
    id: 'canvas.custom',
    events: ['pointerdown'],
    handlers: {
      pointerdown() {
        return { patches: [{ path: '/canvas/session/custom', value: true }] };
      }
    }
  }, createZoomCanvasTool(), createMarqueeSelectCanvasTool()]
});

const frame: FrontierCanvasFrame = materializeCanvasFrame({ surface });
const registry = createCanvasToolRegistry({ tools: surface.tools });
const tool: FrontierCanvasTool | undefined = registry.get('canvas.custom');
const record = registry.dispatch({
  event: { type: 'pointerdown', screen: { x: 1, y: 1 } },
  context: {
    surface,
    session: surface.session,
    camera: surface.session.camera,
    viewport: surface.session.viewport,
    frame
  }
});

const fitPlan: FrontierCanvasPlan = planCanvasFitBounds({
  bounds: { x: 0, y: 0, width: 10, height: 10 },
  viewport: surface.session.viewport,
  camera: surface.session.camera
});
const selected: string[] = selectCanvasItemsInRect({
  frame,
  rect: { x: 0, y: 0, width: 10, height: 10 },
  mode: 'contain'
});
const plan: FrontierCanvasPlan | undefined = record.plans[0] ?? fitPlan;

surface.id satisfies string;
frame.items.length satisfies number;
tool?.events.length satisfies number | undefined;
plan?.patches.length satisfies number | undefined;
selected.length satisfies number;
