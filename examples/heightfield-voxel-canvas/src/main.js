import {
  createCanvasStateLayout,
  createCanvasSurface,
  createCanvasToolRegistry,
  defineCanvasTool,
  materializeCanvasGrid,
  planCanvasPan
} from '@shapeshift-labs/frontier-canvas';
import {
  bresenhamCells,
  canUseCanvasTool,
  createCanvasToolMachine,
  createCanvasToolsAiManifest,
  rectCells,
  scanlineFloodFillCells,
  selectCanvasTool,
  setCanvasToolControl
} from '@shapeshift-labs/frontier-canvas-tools';
import {
  buildTerrainMesh,
  cellKey,
  createInitialTerrain,
  ATLAS_ROWS,
  HEIGHT_UNIT,
  loadBlobMaskPolygonAtlas,
  MATERIALS,
  normalizeHeight,
  normalizeTileSource,
  parseCellKey,
  readTerrainCell,
  terrainFootprintContainsPointAtLayer,
  TILE_SOURCES,
  terrainBounds
} from './mesh.js';

const canvas = document.getElementById('scene');
const gl = canvas.getContext('webgl2', {
  antialias: false,
  alpha: false,
  depth: true,
  premultipliedAlpha: false
});

if (!gl) throw new Error('WebGL2 is required for this demo');

const CAMERA_PATH = '/canvas/session/camera';
const LIGHTING_PATH = '/canvas/session/lighting';
const CELLS_PATH = '/terrain/cells';
const SETTINGS_PATH = '/terrain/settings';
const TOOL_MACHINE_PATH = '/canvas/session/toolMachine';
const MAX_HEIGHT = 16;
const CAMERA_TILT_HEIGHT = 42;
const CAMERA_TILT_DEPTH = 58;
const CAMERA_GROUND_Y_SCALE = CAMERA_TILT_HEIGHT / Math.hypot(CAMERA_TILT_HEIGHT, CAMERA_TILT_DEPTH);
const SNAPSHOT_STORAGE_KEY = 'frontier.heightfieldVoxelCanvas.snapshot.v4';
const SNAPSHOT_ENDPOINT = '/__frontier/heightfield-state';
const INITIAL_SNAPSHOT = readLocalSnapshot();
const DEFAULT_TERRAIN_RADIUS = 10;
const DEFAULT_CAMERA = { x: -10.5, y: -8.5, zoom: 42, minZoom: 12, maxZoom: 124 };
const DEFAULT_VIEWPORT = { width: 1, height: 1, dpr: 1, left: 0, top: 0 };
const DEFAULT_GRID = { enabled: true, size: 1, subdivisions: 1, majorEvery: 4, minScreenStep: 18, maxLines: 320 };
const DEFAULT_LIGHTING = { exposure: 106, wallContrast: 16, edgeStrength: 42, shadowStrength: 84 };
const TILE_SOURCE_IDS = [...TILE_SOURCES];
const TILE_SOURCE_URLS = {
  grass: '/assets/tiles/dcaf8693-48b4-4396-b08c-a5be48d6339d.png',
  stone: '/assets/tiles/87fd8ddb-3344-47f8-971b-584175c48448.png',
  clay: '/assets/tiles/cce6eac8-ba93-4456-9986-b53d670c1515.png'
};
const DEFAULT_SETTINGS = {
  heightStep: 1,
  brushSize: 1,
  shape: 'rounded',
  textureShape: 'rounded',
  top: 'beveled',
  topSource: 'grass',
  baseTopSource: 'grass',
  sideSource: 'clay',
  bevelSource: 'grass',
  footSource: 'clay',
  fillContiguous: true
};
const DEBUG_HISTORY_PREVIEW_RADIUS = 8;
const DEBUG_JSON_TEXT_LIMIT = 36000;

const elements = {
  toolbar: document.querySelector('.toolbar'),
  toolButtons: Array.from(document.querySelectorAll('[data-tool]')),
  heightStep: document.getElementById('height-step'),
  heightStepValue: document.getElementById('height-step-value'),
  brushSize: document.getElementById('brush-size'),
  brushSizeValue: document.getElementById('brush-size-value'),
  shapeMode: document.getElementById('shape-mode'),
  textureShapeMode: document.getElementById('texture-shape-mode'),
  topMode: document.getElementById('top-mode'),
  baseTopSource: document.getElementById('prefab-base-top'),
  topSource: document.getElementById('prefab-top'),
  sideSource: document.getElementById('prefab-side'),
  bevelSource: document.getElementById('prefab-bevel'),
  footSource: document.getElementById('prefab-foot'),
  lightExposure: document.getElementById('light-exposure'),
  lightExposureValue: document.getElementById('light-exposure-value'),
  wallContrast: document.getElementById('wall-contrast'),
  wallContrastValue: document.getElementById('wall-contrast-value'),
  edgeStrength: document.getElementById('edge-strength'),
  edgeStrengthValue: document.getElementById('edge-strength-value'),
  shadowStrength: document.getElementById('shadow-strength'),
  shadowStrengthValue: document.getElementById('shadow-strength-value'),
  fillContiguous: document.getElementById('fill-contiguous'),
  resetCamera: document.getElementById('reset-camera'),
  resetTerrain: document.getElementById('reset-terrain'),
  zoomOut: document.getElementById('zoom-out'),
  zoomIn: document.getElementById('zoom-in'),
  zoomValue: document.getElementById('zoom-value'),
  debugToggle: document.getElementById('debug-toggle'),
  debugPanel: document.getElementById('debug-panel'),
  debugTimeline: document.getElementById('debug-timeline'),
  debugLabel: document.getElementById('debug-label'),
  debugLive: document.getElementById('debug-live'),
  debugRevert: document.getElementById('debug-revert'),
  debugPrev: document.getElementById('debug-prev'),
  debugNext: document.getElementById('debug-next'),
  debugAction: document.getElementById('debug-action'),
  debugHistory: document.getElementById('debug-history'),
  debugPatches: document.getElementById('debug-patches'),
  debugState: document.getElementById('debug-state'),
  statusTool: document.getElementById('status-tool'),
  statusCell: document.getElementById('status-cell'),
  statusHeight: document.getElementById('status-height'),
  statusMesh: document.getElementById('status-mesh')
};

const capabilities = ['canvas.view', 'terrain.paint', 'terrain.erase', 'terrain.fill', 'terrain.sample'];
const layout = createCanvasStateLayout({
  rootPath: '/canvas',
  extraPaths: [
    { id: 'terrain.cells', role: 'terrainCells', path: CELLS_PATH, scope: 'crdt' },
    { id: 'terrain.settings', role: 'terrainSettings', path: SETTINGS_PATH, scope: 'local', ephemeral: true },
    { id: 'canvas.lighting', role: 'renderLighting', path: LIGHTING_PATH, scope: 'local', ephemeral: true },
    { id: 'terrain.toolMachine', role: 'toolMachine', path: TOOL_MACHINE_PATH, scope: 'local', ephemeral: true }
  ]
});

const state = {
  canvas: {
    surface: createCanvasSurface({
      id: 'heightfield-voxel-canvas',
      title: 'Heightfield Voxel Canvas',
      package: '@shapeshift-labs/frontier-canvas',
      feature: 'examples.heightfield-voxel-canvas',
      statePath: '/canvas',
      session: {
        camera: { ...DEFAULT_CAMERA, ...(INITIAL_SNAPSHOT?.camera || {}) },
        viewport: { ...DEFAULT_VIEWPORT },
        grid: { ...DEFAULT_GRID },
        lighting: normalizeLighting(INITIAL_SNAPSHOT?.lighting)
      },
      metadata: {
        renderer: 'webgl2',
        projection: 'orthographic',
        perspective: 'zelda-like-front-tilt',
        mesh: 'heightfield-face-construction',
        maskAtlas: 'inkwell-grey-blob-mask'
      }
    }),
    session: {
      camera: { ...DEFAULT_CAMERA, ...(INITIAL_SNAPSHOT?.camera || {}) },
      viewport: { ...DEFAULT_VIEWPORT },
      grid: { ...DEFAULT_GRID },
      lighting: normalizeLighting(INITIAL_SNAPSHOT?.lighting)
    }
  },
  terrain: {
    cells: INITIAL_SNAPSHOT?.terrain?.cells || createInitialTerrain(DEFAULT_TERRAIN_RADIUS),
    settings: { ...DEFAULT_SETTINGS, ...(INITIAL_SNAPSHOT?.terrain?.settings || {}) }
  },
  ui: {
    activeToolId: 'terrain.brush',
    hoverCell: null,
    previewCells: [],
    previewHeight: 1,
    lastRecord: null,
    meshSummary: { cellCount: 0, vertexCount: 0, triangleCount: 0 }
  },
  debug: {
    open: false,
    previewMode: false,
    selectedIndex: 0,
    snapshots: [],
    history: []
  },
  history: {
    undoStack: [],
    redoStack: []
  },
  actions: []
};

state.terrain.settings = currentSettings(state.terrain.settings);

state.canvas.toolMachine = createCanvasToolMachine({
  path: TOOL_MACHINE_PATH,
  activeToolId: state.ui.activeToolId,
  modes: [
    {
      id: 'view',
      title: 'View',
      defaultToolId: 'canvas.pan',
      toolIds: ['canvas.pan']
    },
    {
      id: 'terrain',
      title: 'Terrain',
      defaultToolId: 'terrain.brush',
      toolIds: [
        'terrain.brush',
        'terrain.path',
        'terrain.stairs',
        'terrain.line',
        'terrain.rect',
        'terrain.rectOutline',
        'terrain.erase',
        'terrain.fill',
        'terrain.raise',
        'terrain.lower',
        'terrain.level',
        'terrain.sample'
      ]
    }
  ],
  settingsByTool: {
    'canvas.pan': {},
    'terrain.brush': state.terrain.settings,
    'terrain.path': state.terrain.settings,
    'terrain.stairs': state.terrain.settings,
    'terrain.line': state.terrain.settings,
    'terrain.rect': state.terrain.settings,
    'terrain.rectOutline': state.terrain.settings,
    'terrain.erase': state.terrain.settings,
    'terrain.fill': state.terrain.settings,
    'terrain.raise': state.terrain.settings,
    'terrain.lower': state.terrain.settings,
    'terrain.level': state.terrain.settings,
    'terrain.sample': state.terrain.settings
  }
});

const tools = [
  defineCanvasTool({
    id: 'canvas.pan',
    title: 'Pan canvas',
    description: 'Move the orthographic camera without editing terrain.',
    icon: 'hand',
    cursor: 'grab',
    reads: [CAMERA_PATH],
    writes: [CAMERA_PATH],
    requires: ['canvas.view'],
    events: ['pointerdown', 'pointermove'],
    controls: [
      { type: 'number', id: 'zoom', label: 'Zoom', default: 42, min: 12, max: 124, step: 1 }
    ],
    handlers: {
      pointerdown: () => ({ status: 'ignored', message: 'camera pan is handled by the host pointer adapter' }),
      pointermove: () => ({ status: 'ignored', message: 'camera pan is handled by the host pointer adapter' })
    }
  }),
  createTerrainTool({
    id: 'terrain.brush',
    title: 'Paint terrain',
    description: 'Paint connected heightfield cells at the selected height, shape, top mode, and face textures.',
    icon: 'paintbrush',
    mode: 'brush',
    requires: ['terrain.paint']
  }),
  createTerrainTool({
    id: 'terrain.path',
    title: 'Paint path',
    description: 'Paint a same-height path surface using texture autotile rules without changing the terrain silhouette.',
    icon: 'route',
    mode: 'path',
    requires: ['terrain.paint']
  }),
  createTerrainShapeTool({
    id: 'terrain.stairs',
    title: 'Paint stairs',
    description: 'Preview and commit a connected stair run between the start cell and selected height.',
    icon: 'stairs',
    shapeMode: 'stairs',
    mode: 'stairs'
  }),
  createTerrainShapeTool({
    id: 'terrain.line',
    title: 'Paint line',
    description: 'Preview and commit a Bresenham-connected terrain line.',
    icon: 'slash',
    shapeMode: 'line'
  }),
  createTerrainShapeTool({
    id: 'terrain.rect',
    title: 'Paint rectangle',
    description: 'Preview and commit a filled terrain rectangle.',
    icon: 'square',
    shapeMode: 'rect'
  }),
  createTerrainShapeTool({
    id: 'terrain.rectOutline',
    title: 'Paint rectangle outline',
    description: 'Preview and commit a terrain rectangle outline.',
    icon: 'square-dashed',
    shapeMode: 'rectOutline'
  }),
  createTerrainTool({
    id: 'terrain.erase',
    title: 'Erase terrain',
    description: 'Remove painted heightfield cells using the same connected grid stroke path as the brush.',
    icon: 'eraser',
    mode: 'erase',
    requires: ['terrain.erase']
  }),
  createTerrainTool({
    id: 'terrain.fill',
    title: 'Fill terrain',
    description: 'Flood-fill matching terrain cells with the selected height, shape, top mode, and face textures.',
    icon: 'paint-bucket',
    mode: 'fill',
    requires: ['terrain.fill'],
    events: ['pointerdown']
  }),
  createTerrainTool({
    id: 'terrain.raise',
    title: 'Raise terrain',
    description: 'Increase painted heightfield cells by the selected height step.',
    icon: 'arrow-up',
    mode: 'raise',
    requires: ['terrain.paint']
  }),
  createTerrainTool({
    id: 'terrain.lower',
    title: 'Lower terrain',
    description: 'Decrease painted heightfield cells by the selected height step.',
    icon: 'arrow-down',
    mode: 'lower',
    requires: ['terrain.paint']
  }),
  createTerrainTool({
    id: 'terrain.level',
    title: 'Set terrain height',
    description: 'Set painted heightfield cells to the selected absolute height.',
    icon: 'equal',
    mode: 'level',
    requires: ['terrain.paint']
  }),
  defineCanvasTool({
    id: 'terrain.sample',
    title: 'Sample terrain cell',
    description: 'Sample face textures, shape, top mode, and height from a terrain cell.',
    icon: 'pipette',
    cursor: 'crosshair',
    reads: [CELLS_PATH],
    writes: [SETTINGS_PATH],
    requires: ['terrain.sample'],
    events: ['pointerdown'],
    controls: terrainControls(),
    handlers: {
      pointerdown(context, event) {
        const input = event.input || {};
        const cell = input.cell;
        if (!cell) return { status: 'ignored', message: 'sample requires a picked cell' };
        const existing = readTerrainCell(context.state.terrain.cells, cell.x, cell.z);
        if (!existing) return { status: 'ignored', message: 'empty terrain cell' };
        return {
          patches: [
            { op: 'set', path: `${SETTINGS_PATH}/heightStep`, value: existing.height },
            { op: 'set', path: `${SETTINGS_PATH}/baseTopSource`, value: existing.baseTopSource },
            { op: 'set', path: `${SETTINGS_PATH}/topSource`, value: existing.topSource },
            { op: 'set', path: `${SETTINGS_PATH}/sideSource`, value: existing.sideSource },
            { op: 'set', path: `${SETTINGS_PATH}/bevelSource`, value: existing.bevelSource },
            { op: 'set', path: `${SETTINGS_PATH}/footSource`, value: existing.footSource },
            { op: 'set', path: `${SETTINGS_PATH}/shape`, value: existing.shape },
            { op: 'set', path: `${SETTINGS_PATH}/textureShape`, value: existing.textureShape },
            { op: 'set', path: `${SETTINGS_PATH}/top`, value: existing.top }
          ],
          metadata: { sampled: { ...cell, ...existing } }
        };
      }
    }
  })
];

const registry = createCanvasToolRegistry({ tools, activeToolId: state.ui.activeToolId });
const aiManifest = createCanvasToolsAiManifest({
  id: 'heightfield-voxel-canvas-tools',
  title: 'Heightfield voxel canvas tools',
  tools,
  namespace: 'heightfield',
  route: 'route:/examples/heightfield-voxel-canvas',
  package: '@shapeshift-labs/frontier-canvas',
  feature: 'examples.heightfield-voxel-canvas'
});

let renderer = null;
let meshDirty = true;
let lineDirty = true;
let activePointer = null;
let spacePanning = false;
let lastFrame = 0;
let snapshotPersistTimer = 0;
let debugPanelSyncPending = false;
let atlasRebuildTimer = 0;
let atlasRebuildPending = false;

window.frontierHeightfieldVoxelCanvas = {
  state,
  layout,
  registry,
  aiManifest,
  exportSnapshot: createAppSnapshot,
  importSnapshot: (snapshot, options = {}) => applyAppSnapshot(snapshot, options),
  pickTerrainCellForScreen: (screen) => {
    const picked = pickTerrain(screen);
    return {
      x: picked.x,
      y: picked.y,
      z: picked.z,
      cell: { ...picked.cell }
    };
  },
  clearSavedSnapshot: () => {
    try {
      window.localStorage?.removeItem(SNAPSHOT_STORAGE_KEY);
    } catch {
      // Local persistence is best-effort only.
    }
  },
  rebuildMesh: () => {
    meshDirty = true;
    lineDirty = true;
  },
  applyTerrainCellEdit: (x, z, value, action = 'agent.terrainCellEdit') => {
    const patch = {
      op: 'set',
      path: `${CELLS_PATH}/${cellKey(x, z)}`,
      value
    };
    const inversePatches = applyPatches([patch]);
    recordAction(action, [patch], {
      toolId: action,
      status: 'ok',
      patches: [patch],
      metadata: { cell: { x, z } }
    }, {
      undoable: true,
      inversePatches
    });
    meshDirty = true;
    lineDirty = true;
    return { patch, inversePatches };
  }
};

function createAppSnapshot(options = {}) {
  const includeHistory = options.includeHistory !== false;
  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    terrain: {
      cells: cloneJson(state.terrain.cells),
      settings: cloneJson(state.terrain.settings)
    },
    camera: { ...state.canvas.session.camera },
    lighting: { ...state.canvas.session.lighting },
    activeToolId: state.ui.activeToolId,
    debug: {
      open: state.debug.open,
      selectedIndex: state.debug.selectedIndex,
      previewMode: false
    }
  };
  if (includeHistory) {
    snapshot.actions = cloneJson(state.actions);
    snapshot.history = {
      undoStack: cloneJson(state.history.undoStack),
      redoStack: cloneJson(state.history.redoStack)
    };
    snapshot.debug.snapshots = cloneJson(state.debug.snapshots);
    snapshot.debug.history = cloneJson(state.debug.history);
  }
  return snapshot;
}

function applyAppSnapshot(snapshot, options = {}) {
  const source = snapshot?.state || snapshot;
  if (!source || typeof source !== 'object') return false;
  if (source.terrain?.cells && typeof source.terrain.cells === 'object') state.terrain.cells = cloneJson(source.terrain.cells);
  if (source.terrain?.settings) state.terrain.settings = currentSettings(source.terrain.settings);
  if (source.camera) state.canvas.session.camera = { ...state.canvas.session.camera, ...source.camera };
  if (source.lighting) {
    state.canvas.session.lighting = normalizeLighting(source.lighting);
    state.canvas.surface.session.lighting = { ...state.canvas.session.lighting };
  }
  if (source.activeToolId && registry.get(source.activeToolId)) state.ui.activeToolId = source.activeToolId;
  if (Array.isArray(source.actions)) {
    state.actions = cloneJson(source.actions);
    state.debug.history = state.actions;
  }
  if (source.history?.undoStack && source.history?.redoStack) {
    state.history.undoStack = cloneJson(source.history.undoStack);
    state.history.redoStack = cloneJson(source.history.redoStack);
  }
  if (source.debug) {
    state.debug.open = source.debug.open === true;
    state.debug.previewMode = false;
    if (Array.isArray(source.debug.snapshots)) state.debug.snapshots = cloneJson(source.debug.snapshots);
    if (Array.isArray(source.debug.history)) state.debug.history = cloneJson(source.debug.history);
  }
  meshDirty = true;
  lineDirty = true;
  syncControls();
  syncDebugPanel();
  if (options.record !== false) recordAction(options.action || 'snapshot.import', [], null);
  else persistSnapshotSoon();
  return true;
}

function createTerrainTool({ id, title, description, icon, mode, requires, events }) {
  return defineCanvasTool({
    id,
    title,
    description,
    icon,
    cursor: 'crosshair',
    reads: [CELLS_PATH, SETTINGS_PATH],
    writes: [CELLS_PATH],
    requires,
    events: events || ['pointerdown', 'pointermove'],
    controls: terrainControls(),
    expectedPatch: [
      { op: mode === 'erase' ? 'remove' : 'set', path: `${CELLS_PATH}/:x,:z` }
    ],
    handlers: {
      pointerdown: (context, event) => terrainEditResult(context, event, mode),
      pointermove: (context, event) => terrainEditResult(context, event, mode)
    }
  });
}

function createTerrainShapeTool({ id, title, description, icon, shapeMode, mode = 'brush' }) {
  return defineCanvasTool({
    id,
    title,
    description,
    icon,
    cursor: 'crosshair',
    reads: [CELLS_PATH, SETTINGS_PATH],
    writes: [CELLS_PATH],
    requires: ['terrain.paint'],
    events: ['pointerdown', 'pointermove', 'pointerup', 'cancel'],
    controls: terrainControls(),
    expectedPatch: [
      { op: 'set', path: `${CELLS_PATH}/:x,:z` }
    ],
    handlers: {
      pointerdown: () => ({ status: 'ignored', message: `${shapeMode} preview starts in the host pointer adapter` }),
      pointermove: () => ({ status: 'ignored', message: `${shapeMode} preview updates in the host pointer adapter` }),
      pointerup: (context, event) => terrainEditResult(context, event, mode),
      cancel: () => ({ status: 'cancelled' })
    }
  });
}

function terrainControls() {
  return [
    { type: 'number', id: 'heightStep', label: 'Height', default: 1, min: 1, max: MAX_HEIGHT, step: 1 },
    { type: 'number', id: 'brushSize', label: 'Brush', default: 1, min: 1, max: 5, step: 1 },
    {
      type: 'select',
      id: 'shape',
      label: 'Shape',
      default: 'boxy',
      options: [
        { value: 'full', label: 'Full' },
        { value: 'boxy', label: 'Boxy blob' },
        { value: 'rounded', label: 'Rounded blob' }
      ]
    },
    {
      type: 'select',
      id: 'textureShape',
      label: 'Texture rule',
      default: 'rounded',
      options: [
        { value: 'full', label: 'Full' },
        { value: 'boxy', label: 'Boxy' },
        { value: 'rounded', label: 'Rounded' }
      ]
    },
    {
      type: 'select',
      id: 'top',
      label: 'Top',
      default: 'beveled',
      options: [
        { value: 'flat', label: 'Flat' },
        { value: 'beveled', label: 'Beveled' },
        { value: 'rounded', label: 'Rounded' }
      ]
    },
    {
      type: 'select',
      id: 'baseTopSource',
      label: 'Base top',
      default: 'grass',
      options: tileSourceOptions()
    },
    {
      type: 'select',
      id: 'topSource',
      label: 'Top tile',
      default: 'grass',
      options: tileSourceOptions()
    },
    {
      type: 'select',
      id: 'sideSource',
      label: 'Wall tile',
      default: 'clay',
      options: tileSourceOptions()
    },
    {
      type: 'select',
      id: 'bevelSource',
      label: 'Bevel tile',
      default: 'grass',
      options: tileSourceOptions()
    },
    {
      type: 'select',
      id: 'footSource',
      label: 'Foot tile',
      default: 'clay',
      options: tileSourceOptions()
    },
    { type: 'toggle', id: 'fillContiguous', label: 'Contiguous fill', default: true }
  ];
}

function tileSourceOptions() {
  return [
    { value: 'grass', label: 'Grass' },
    { value: 'stone', label: 'Stone' },
    { value: 'clay', label: 'Clay' }
  ];
}

function terrainEditResult(context, event, mode) {
  const input = event.input || {};
  const cell = input.cell;
  if (!cell) return { status: 'ignored', message: 'terrain edit requires a picked cell' };
  const settings = currentSettings(input);
  if (mode === 'fill') return terrainFillResult(context, cell, settings);
  const strokeCells = normalizeStrokeCells(input.strokeCells || [cell]);
  const stairHeights = mode === 'stairs' ? createStairHeights(context.state.terrain.cells, strokeCells, settings) : null;
  const patches = [];
  const seen = new Set();
  const touchedKeys = input.touchedKeys instanceof Set ? input.touchedKeys : null;
  for (const strokeCell of strokeCells) {
    for (const target of brushCells(strokeCell, settings.brushSize)) {
      const key = cellKey(target.x, target.z);
      if (seen.has(key) || touchedKeys?.has(key)) continue;
      seen.add(key);
      touchedKeys?.add(key);
      const current = readTerrainCell(context.state.terrain.cells, target.x, target.z);
      const nextHeight = stairHeights
        ? stairHeights.get(cellKey(strokeCell.x, strokeCell.z)) || settings.heightStep
        : nextTerrainHeight(current?.height || 0, settings.heightStep, mode);
      const path = `${CELLS_PATH}/${key}`;
      if (nextHeight <= 0) {
        if (current) patches.push({ op: 'remove', path });
        continue;
      }
      const nextCell = nextTerrainCell(current, nextHeight, settings, mode);
      if (
        current &&
        current.height === nextCell.height &&
        current.baseTopSource === nextCell.baseTopSource &&
        current.topSource === nextCell.topSource &&
        current.sideSource === nextCell.sideSource &&
        current.bevelSource === nextCell.bevelSource &&
        current.footSource === nextCell.footSource &&
        current.shape === nextCell.shape &&
        current.textureShape === nextCell.textureShape &&
        current.top === nextCell.top
      ) {
        continue;
      }
      patches.push({
        op: 'set',
        path,
        value: nextCell
      });
    }
  }
  return {
    patches,
    metadata: {
      brushSize: settings.brushSize,
      mode,
      cell,
      strokeCells: strokeCells.length,
      touchedCells: seen.size
    }
  };
}

function nextTerrainHeight(current, step, mode) {
  if (mode === 'erase') return 0;
  if (mode === 'brush' || mode === 'path') return normalizeHeight(mode === 'path' && current > 0 ? current : step);
  if (mode === 'stairs') return normalizeHeight(step);
  if (mode === 'lower') return normalizeHeight(current - step);
  if (mode === 'level') return normalizeHeight(step);
  return normalizeHeight(current + step);
}

function nextTerrainCell(current, height, settings, mode) {
  if (mode === 'path' || mode === 'stairs') {
    const fallback = current || {};
    return {
      height,
      baseTopSource: settings.baseTopSource || fallback.baseTopSource || 'grass',
      topSource: mode === 'stairs' ? 'stone' : settings.topSource === settings.baseTopSource ? 'stone' : settings.topSource,
      sideSource: mode === 'stairs' ? 'stone' : fallback.sideSource || settings.sideSource,
      bevelSource: mode === 'stairs' ? 'stone' : fallback.bevelSource || settings.bevelSource,
      footSource: mode === 'stairs' ? 'stone' : fallback.footSource || settings.footSource,
      shape: mode === 'stairs' ? 'full' : fallback.shape || settings.shape,
      textureShape: settings.textureShape,
      top: mode === 'stairs' ? 'flat' : fallback.top || settings.top,
      slope: 'none'
    };
  }
  return {
    height,
    baseTopSource: settings.baseTopSource,
    topSource: settings.topSource,
    sideSource: settings.sideSource,
    bevelSource: settings.bevelSource,
    footSource: settings.footSource,
    shape: settings.shape,
    textureShape: settings.textureShape,
    top: settings.top,
    slope: 'none'
  };
}

function createStairHeights(cells, strokeCells, settings) {
  const out = new Map();
  const line = normalizeStrokeCells(strokeCells);
  if (!line.length) return out;
  const start = line[0];
  const startCell = readTerrainCell(cells, start.x, start.z);
  const startHeight = normalizeHeight(startCell?.height || 1) || 1;
  const endHeight = normalizeHeight(settings.heightStep) || startHeight;
  const last = Math.max(1, line.length - 1);
  for (let i = 0; i < line.length; i += 1) {
    const t = i / last;
    const height = normalizeHeight(Math.round(startHeight + (endHeight - startHeight) * t)) || 1;
    out.set(cellKey(line[i].x, line[i].z), height);
  }
  return out;
}

function terrainFillResult(context, startCell, settings) {
  const snapshot = createFillSnapshot(context.state.terrain.cells, startCell);
  const cells = scanlineFloodFillCells({
    start: { x: startCell.x, y: startCell.z },
    snapshot,
    contiguous: settings.fillContiguous,
    emptyValue: null,
    maxCells: 24000
  });
  const patches = [];
  for (const filled of cells) {
    const x = filled.x;
    const z = filled.y;
    const path = `${CELLS_PATH}/${cellKey(x, z)}`;
    const current = readTerrainCell(context.state.terrain.cells, x, z);
    const nextHeight = normalizeHeight(settings.heightStep);
    if (
      current &&
      current.height === nextHeight &&
      current.baseTopSource === settings.baseTopSource &&
      current.topSource === settings.topSource &&
      current.sideSource === settings.sideSource &&
      current.bevelSource === settings.bevelSource &&
      current.footSource === settings.footSource &&
      current.shape === settings.shape &&
      current.textureShape === settings.textureShape &&
      current.top === settings.top
    ) {
      continue;
    }
    patches.push({
      op: 'set',
      path,
      value: nextTerrainCell(current, nextHeight, settings, 'fill')
    });
  }
  return {
    patches,
    metadata: {
      mode: 'fill',
      cell: startCell,
      contiguous: settings.fillContiguous,
      filledCells: cells.length
    }
  };
}

function normalizeStrokeCells(cells) {
  const out = [];
  const seen = new Set();
  for (const raw of cells || []) {
    const x = Math.trunc(Number(raw?.x));
    const z = Math.trunc(Number(raw?.z ?? raw?.y));
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const key = cellKey(x, z);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x, z });
  }
  return out.length ? out : [];
}

function createFillSnapshot(cells, startCell) {
  const bounds = terrainBounds(cells);
  const padding = 8;
  const snapshotCells = {};
  for (const [key, raw] of Object.entries(cells || {})) {
    const { x, z } = parseCellKey(key);
    const cell = readTerrainCell({ [key]: raw }, x, z);
    if (!cell) continue;
    snapshotCells[cellKey(x, z)] = terrainFillValue(cell);
  }
  return {
    cells: snapshotCells,
    bounds: {
      x: Math.min(bounds.x, startCell.x) - padding,
      y: Math.min(bounds.z, startCell.z) - padding,
      width: Math.max(bounds.width, Math.abs(startCell.x - bounds.x) + 1) + padding * 2,
      height: Math.max(bounds.depth, Math.abs(startCell.z - bounds.z) + 1) + padding * 2
    }
  };
}

function terrainFillValue(cell) {
  return `${cell.height}|${cell.baseTopSource}|${cell.topSource}|${cell.sideSource}|${cell.bevelSource}|${cell.footSource}|${cell.shape}|${cell.textureShape}|${cell.top}`;
}

function currentSettings(input = {}) {
  const heightStep = normalizeHeight(input.heightStep ?? state.terrain.settings.heightStep ?? 1) || 1;
  const legacyMaterial = input.material ?? state.terrain.settings.material;
  const legacyDefaults = legacyMaterial === 'stone'
    ? { topSource: 'stone', sideSource: 'stone', bevelSource: 'stone' }
    : legacyMaterial === 'clay'
      ? { topSource: 'clay', sideSource: 'clay', bevelSource: 'clay' }
      : { topSource: 'grass', sideSource: 'clay', bevelSource: 'grass' };
  return {
    heightStep,
    brushSize: Math.max(1, Math.min(5, Math.trunc(Number(input.brushSize ?? state.terrain.settings.brushSize) || 1))),
    shape: readChoice(input.shape ?? state.terrain.settings.shape, ['full', 'boxy', 'rounded'], DEFAULT_SETTINGS.shape),
    textureShape: readChoice(input.textureShape ?? state.terrain.settings.textureShape, ['full', 'boxy', 'rounded'], 'rounded'),
    top: readChoice(input.top ?? state.terrain.settings.top, ['flat', 'beveled', 'rounded'], 'beveled'),
    baseTopSource: normalizeTileSource(input.baseTopSource ?? input.groundSource ?? state.terrain.settings.baseTopSource, legacyDefaults.topSource),
    topSource: normalizeTileSource(input.topSource ?? input.cube?.top ?? state.terrain.settings.topSource, legacyDefaults.topSource),
    sideSource: normalizeTileSource(input.sideSource ?? input.wallSource ?? input.cube?.side ?? state.terrain.settings.sideSource, legacyDefaults.sideSource),
    bevelSource: normalizeTileSource(input.bevelSource ?? input.cube?.bevel ?? state.terrain.settings.bevelSource, legacyDefaults.bevelSource),
    footSource: normalizeTileSource(input.footSource ?? input.baseSource ?? input.cube?.foot ?? state.terrain.settings.footSource, legacyDefaults.sideSource),
    fillContiguous: readBoolean(input.fillContiguous ?? state.terrain.settings.fillContiguous, true)
  };
}

function normalizeLighting(input = {}) {
  return {
    exposure: clampNumber(input?.exposure, 70, 140, DEFAULT_LIGHTING.exposure),
    wallContrast: clampNumber(input?.wallContrast, 0, 60, DEFAULT_LIGHTING.wallContrast),
    edgeStrength: clampNumber(input?.edgeStrength, 0, 80, DEFAULT_LIGHTING.edgeStrength),
    shadowStrength: clampNumber(input?.shadowStrength, 0, 100, DEFAULT_LIGHTING.shadowStrength)
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function readBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function readChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function brushCells(center, size) {
  const radius = Math.max(0, Math.floor((size - 1) / 2));
  const cells = [];
  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.hypot(dx, dz) <= radius + 0.6) cells.push({ x: center.x + dx, z: center.z + dz });
    }
  }
  return cells.length ? cells : [center];
}

function bindUi() {
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    if (handleHistoryHotkey(event)) return;
    if (event.code === 'Space') {
      spacePanning = true;
      canvas.classList.add('panning');
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      spacePanning = false;
      canvas.classList.remove('panning');
    }
    if (event.key === '0') fitCameraToTerrain();
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  for (const button of elements.toolButtons) {
    button.addEventListener('click', () => setActiveTool(button.dataset.tool));
  }
  elements.heightStep.addEventListener('input', () => setSetting('heightStep', Number(elements.heightStep.value)));
  elements.brushSize.addEventListener('input', () => setSetting('brushSize', Number(elements.brushSize.value)));
  elements.shapeMode.addEventListener('change', () => setSetting('shape', elements.shapeMode.value));
  elements.textureShapeMode.addEventListener('change', () => setSetting('textureShape', elements.textureShapeMode.value));
  elements.topMode.addEventListener('change', () => setSetting('top', elements.topMode.value));
  elements.baseTopSource.addEventListener('change', () => setSetting('baseTopSource', elements.baseTopSource.value));
  elements.topSource.addEventListener('change', () => setSetting('topSource', elements.topSource.value));
  elements.sideSource.addEventListener('change', () => setSetting('sideSource', elements.sideSource.value));
  elements.bevelSource.addEventListener('change', () => setSetting('bevelSource', elements.bevelSource.value));
  elements.footSource.addEventListener('change', () => setSetting('footSource', elements.footSource.value));
  elements.lightExposure.addEventListener('input', () => setLighting('exposure', Number(elements.lightExposure.value)));
  elements.wallContrast.addEventListener('input', () => setLighting('wallContrast', Number(elements.wallContrast.value)));
  elements.edgeStrength.addEventListener('input', () => setLighting('edgeStrength', Number(elements.edgeStrength.value)));
  elements.shadowStrength.addEventListener('input', () => setLighting('shadowStrength', Number(elements.shadowStrength.value)));
  elements.fillContiguous.addEventListener('change', () => setSetting('fillContiguous', elements.fillContiguous.checked));
  elements.resetCamera.addEventListener('click', fitCameraToTerrain);
  elements.zoomOut.addEventListener('click', () => zoomAtScreen({ x: canvas.clientWidth * 0.5, y: canvas.clientHeight * 0.5 }, 0.82));
  elements.zoomIn.addEventListener('click', () => zoomAtScreen({ x: canvas.clientWidth * 0.5, y: canvas.clientHeight * 0.5 }, 1.22));
  elements.debugToggle.addEventListener('click', () => {
    state.debug.open = !state.debug.open;
    syncDebugPanel();
    persistSnapshotSoon();
  });
  elements.debugTimeline.addEventListener('input', () => previewDebugSnapshot(Number(elements.debugTimeline.value)));
  elements.debugLive.addEventListener('click', resumeLiveDebug);
  elements.debugRevert.addEventListener('click', revertToDebugSnapshot);
  elements.debugPrev.addEventListener('click', () => previewDebugSnapshot(state.debug.selectedIndex - 1));
  elements.debugNext.addEventListener('click', () => previewDebugSnapshot(state.debug.selectedIndex + 1));
  elements.resetTerrain.addEventListener('click', () => {
    const patches = [{ op: 'set', path: CELLS_PATH, value: createInitialTerrain(DEFAULT_TERRAIN_RADIUS) }];
    const inversePatches = applyPatches(patches);
    recordAction('terrain.reset', patches, null, { undoable: true, inversePatches });
    meshDirty = true;
    lineDirty = true;
    fitCameraToTerrain();
  });
  syncControls();
  syncDebugPanel();
}

function setActiveTool(toolId) {
  const tool = registry.get(toolId);
  if (!tool) return;
  const permission = canUseCanvasTool(tool, { capabilities });
  if (!permission.allowed) return;
  state.ui.activeToolId = toolId;
  clearShapePreview();
  registry.activeToolId = toolId;
  const transition = selectCanvasTool(state.canvas.toolMachine, toolId, { path: TOOL_MACHINE_PATH });
  state.canvas.toolMachine = transition.machine;
  applyPatches(transition.patches);
  syncControls();
  persistSnapshotSoon();
}

function setSetting(key, value) {
  const settings = { ...state.terrain.settings, [key]: value };
  state.terrain.settings = currentSettings(settings);
  const transition = setCanvasToolControl(
    state.canvas.toolMachine,
    state.ui.activeToolId,
    key,
    state.terrain.settings[key],
    { path: TOOL_MACHINE_PATH }
  );
  state.canvas.toolMachine = transition.machine;
  applyPatches(transition.patches);
  syncControls();
  meshDirty = true;
  lineDirty = true;
  persistSnapshotSoon();
}

function setLighting(key, value) {
  state.canvas.session.lighting = normalizeLighting({
    ...state.canvas.session.lighting,
    [key]: value
  });
  state.canvas.surface.session.lighting = { ...state.canvas.session.lighting };
  syncControls();
  persistSnapshotSoon();
}

function syncControls() {
  const settings = currentSettings();
  const lighting = normalizeLighting(state.canvas.session.lighting);
  elements.heightStep.value = String(settings.heightStep);
  elements.heightStepValue.value = String(settings.heightStep);
  elements.heightStepValue.textContent = String(settings.heightStep);
  elements.brushSize.value = String(settings.brushSize);
  elements.brushSizeValue.value = String(settings.brushSize);
  elements.brushSizeValue.textContent = String(settings.brushSize);
  elements.shapeMode.value = settings.shape;
  elements.textureShapeMode.value = settings.textureShape;
  elements.topMode.value = settings.top;
  elements.baseTopSource.value = settings.baseTopSource;
  elements.topSource.value = settings.topSource;
  elements.sideSource.value = settings.sideSource;
  elements.bevelSource.value = settings.bevelSource;
  elements.footSource.value = settings.footSource;
  syncLightingControl(elements.lightExposure, elements.lightExposureValue, lighting.exposure);
  syncLightingControl(elements.wallContrast, elements.wallContrastValue, lighting.wallContrast);
  syncLightingControl(elements.edgeStrength, elements.edgeStrengthValue, lighting.edgeStrength);
  syncLightingControl(elements.shadowStrength, elements.shadowStrengthValue, lighting.shadowStrength);
  elements.fillContiguous.checked = settings.fillContiguous;
  for (const button of elements.toolButtons) {
    button.classList.toggle('active', button.dataset.tool === state.ui.activeToolId);
  }
  elements.statusTool.textContent = registry.get(state.ui.activeToolId)?.title?.replace(' terrain', '') || state.ui.activeToolId;
  elements.zoomValue.textContent = `${Math.round((state.canvas.session.camera.zoom / 42) * 100)}%`;
  canvas.classList.toggle('tool-pan', state.ui.activeToolId === 'canvas.pan');
}

function syncLightingControl(input, output, value) {
  input.value = String(value);
  output.value = String(value);
  output.textContent = String(value);
}

function onPointerDown(event) {
  if (state.debug.previewMode && event.button === 0) resumeLiveDebug();
  canvas.setPointerCapture(event.pointerId);
  const screen = eventPoint(event);
  const panning = state.ui.activeToolId === 'canvas.pan' || event.button === 1 || event.button === 2 || spacePanning;
  activePointer = {
    id: event.pointerId,
    previousScreen: screen,
    previousCell: null,
    touchedKeys: new Set(),
    transaction: createToolTransaction(state.ui.activeToolId),
    painting: !panning && event.button === 0,
    panning
  };
  canvas.classList.toggle('panning', panning || spacePanning);
  updateHover(screen);
  if (activePointer.painting) {
    if (isShapeTool(state.ui.activeToolId)) beginShapeGesture(screen, event);
    else dispatchTerrainPointer('pointerdown', screen);
  }
}

function onPointerMove(event) {
  const screen = eventPoint(event);
  updateHover(screen);
  if (!activePointer) return;
  if (activePointer.panning) {
    panFromPointer(activePointer.previousScreen, screen);
    activePointer.previousScreen = screen;
    return;
  }
  if (activePointer.painting && event.buttons === 1) {
    if (activePointer.shapeGesture) updateShapeGesture(screen, event);
    else dispatchTerrainPointer('pointermove', screen);
  }
  activePointer.previousScreen = screen;
}

function onPointerUp(event) {
  if (activePointer?.id === event.pointerId) {
    if (activePointer.painting) {
      if (activePointer.shapeGesture) commitShapeGesture(eventPoint(event), event);
      commitToolTransaction(activePointer.transaction);
    }
    clearShapePreview();
    activePointer = null;
    canvas.classList.toggle('panning', spacePanning);
  }
}

function onWheel(event) {
  event.preventDefault();
  const screen = eventPoint(event);
  const wheel = normalizeWheel(event);
  if (event.ctrlKey || event.metaKey || event.altKey) {
    zoomAtScreen(screen, wheel.dy > 0 ? 1 / 1.12 : 1.12);
    return;
  }
  panByWheel(wheel);
}

function zoomAtScreen(screen, factor) {
  const before = pickGround(screen);
  const camera = state.canvas.session.camera;
  const nextZoom = clamp(camera.zoom * factor, camera.minZoom, camera.maxZoom);
  const previousZoom = camera.zoom;
  if (Math.abs(nextZoom - previousZoom) < 0.001) return;
  camera.zoom = nextZoom;
  const after = pickGround(screen);
  camera.x += before.x - after.x;
  camera.y += before.z - after.z;
  recordAction('canvas.zoomAt', [
    { op: 'set', path: `${CAMERA_PATH}/zoom`, value: nextZoom, oldValue: previousZoom },
    { op: 'set', path: `${CAMERA_PATH}/x`, value: camera.x },
    { op: 'set', path: `${CAMERA_PATH}/y`, value: camera.y }
  ]);
  lineDirty = true;
  syncControls();
}

function panByWheel(wheel) {
  const camera = state.canvas.session.camera;
  const dx = wheel.dx / Math.max(1, camera.zoom);
  const dy = wheel.dy / Math.max(1, camera.zoom * CAMERA_GROUND_Y_SCALE);
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;
  camera.x += dx;
  camera.y += dy;
  recordAction('canvas.trackpadPan', [
    { op: 'set', path: `${CAMERA_PATH}/x`, value: camera.x },
    { op: 'set', path: `${CAMERA_PATH}/y`, value: camera.y }
  ]);
  lineDirty = true;
}

function normalizeWheel(event) {
  let dx = 'deltaX' in event ? Number(event.deltaX) || 0 : -(Number(event.wheelDeltaX) || 0);
  let dy = 'deltaY' in event ? Number(event.deltaY) || 0 : -(Number(event.wheelDeltaY ?? event.wheelDelta) || 0);
  if (event.deltaMode === 1) {
    dx *= 16;
    dy *= 16;
  } else if (event.deltaMode === 2) {
    dx *= Math.max(1, state.canvas.session.viewport.width);
    dy *= Math.max(1, state.canvas.session.viewport.height);
  }
  return { dx, dy };
}

function panFromPointer(previousScreen, screen) {
  const previousWorld = pickGround(previousScreen);
  const currentWorld = pickGround(screen);
  const plan = planCanvasPan({
    camera: state.canvas.session.camera,
    viewport: state.canvas.session.viewport,
    deltaWorld: {
      x: previousWorld.x - currentWorld.x,
      y: previousWorld.z - currentWorld.z
    },
    cameraPath: CAMERA_PATH
  });
  applyPatches(plan.patches);
  recordAction('canvas.pan', plan.patches);
  lineDirty = true;
}

function isShapeTool(toolId) {
  return toolId === 'terrain.line' || toolId === 'terrain.rect' || toolId === 'terrain.rectOutline' || toolId === 'terrain.stairs';
}

function beginShapeGesture(screen, event) {
  const picked = pickTerrain(screen);
  const settings = currentSettings();
  activePointer.shapeGesture = {
    startCell: picked.cell,
    currentCell: picked.cell,
    height: settings.heightStep,
    heightDragBase: settings.heightStep,
    heightDragStartY: screen.y
  };
  updateShapePreview();
  activePointer.previousCell = picked.cell;
  event?.preventDefault?.();
}

function updateShapeGesture(screen, event) {
  const gesture = activePointer?.shapeGesture;
  if (!gesture) return;
  if (event?.metaKey || event?.ctrlKey) {
    const delta = Math.round((gesture.heightDragStartY - screen.y) / 28);
    gesture.height = clamp(gesture.heightDragBase + delta, 1, MAX_HEIGHT);
  } else {
    const picked = pickTerrain(screen);
    gesture.currentCell = picked.cell;
    gesture.heightDragBase = gesture.height;
    gesture.heightDragStartY = screen.y;
    activePointer.previousCell = picked.cell;
  }
  updateShapePreview();
}

function commitShapeGesture(screen, event) {
  updateShapeGesture(screen, event);
  const gesture = activePointer?.shapeGesture;
  if (!gesture) return;
  const cells = shapeCellsForTool(state.ui.activeToolId, gesture.startCell, gesture.currentCell);
  if (!cells.length) return;
  dispatchShapePointer('pointerup', screen, cells, gesture.height);
}

function updateShapePreview() {
  const gesture = activePointer?.shapeGesture;
  if (!gesture) {
    clearShapePreview();
    return;
  }
  state.ui.previewCells = shapeCellsForTool(state.ui.activeToolId, gesture.startCell, gesture.currentCell);
  state.ui.previewHeight = gesture.height;
  lineDirty = true;
}

function clearShapePreview() {
  if (state.ui.previewCells.length || state.ui.previewHeight !== currentSettings().heightStep) lineDirty = true;
  state.ui.previewCells = [];
  state.ui.previewHeight = currentSettings().heightStep;
}

function shapeCellsForTool(toolId, startCell, endCell) {
  if (!startCell || !endCell) return [];
  if (toolId === 'terrain.line' || toolId === 'terrain.stairs') {
    return bresenhamCells(startCell.x, startCell.z, endCell.x, endCell.z).map((cell) => ({
      x: cell.x,
      z: cell.y
    }));
  }
  if (toolId === 'terrain.rect' || toolId === 'terrain.rectOutline') {
    const filled = toolId === 'terrain.rect';
    return rectCells(
      { x: startCell.x, y: startCell.z },
      { x: endCell.x, y: endCell.z },
      filled
    ).map((cell) => ({ x: cell.x, z: cell.y }));
  }
  return [];
}

function dispatchTerrainPointer(type, screen) {
  const picked = pickTerrain(screen);
  const cell = picked.cell;
  const strokeCells = strokeCellsForPointer(type, cell);
  const event = {
    type,
    screen,
    world: { x: picked.x, y: picked.z },
    input: {
      cell,
      strokeCells,
      touchedKeys: activePointer?.touchedKeys,
      ...currentSettings()
    }
  };
  const context = {
    state,
    surface: state.canvas.surface,
    session: state.canvas.session,
    camera: state.canvas.session.camera,
    viewport: state.canvas.session.viewport,
    metadata: { layout }
  };
  const record = registry.dispatch({ toolId: state.ui.activeToolId, event, context });
  if (activePointer) activePointer.previousCell = cell;
  if (record.status === 'ok' && record.patches.length) {
    const inversePatches = applyPatches(record.patches);
    appendToolTransaction(activePointer?.transaction, record, inversePatches, type);
    if (record.toolId === 'terrain.sample') syncSampledSettings();
    meshDirty = true;
    lineDirty = true;
  }
  state.ui.lastRecord = record;
}

function dispatchShapePointer(type, screen, strokeCells, previewHeight) {
  const picked = pickTerrain(screen);
  const settings = currentSettings({ heightStep: previewHeight });
  const event = {
    type,
    screen,
    world: { x: picked.x, y: picked.z },
    input: {
      cell: picked.cell,
      strokeCells,
      touchedKeys: activePointer?.touchedKeys,
      ...settings
    }
  };
  const context = {
    state,
    surface: state.canvas.surface,
    session: state.canvas.session,
    camera: state.canvas.session.camera,
    viewport: state.canvas.session.viewport,
    metadata: { layout }
  };
  const record = registry.dispatch({ toolId: state.ui.activeToolId, event, context });
  if (record.status === 'ok' && record.patches.length) {
    const inversePatches = applyPatches(record.patches);
    appendToolTransaction(activePointer?.transaction, record, inversePatches, type);
    meshDirty = true;
    lineDirty = true;
  }
  state.ui.lastRecord = record;
}

function createToolTransaction(toolId) {
  return {
    toolId,
    startedAt: Date.now(),
    patches: [],
    inversePatches: [],
    events: [],
    touchedPaths: new Set()
  };
}

function appendToolTransaction(transaction, record, inversePatches, eventType) {
  if (!transaction || !record?.patches?.length) {
    recordAction(record.toolId + '.' + eventType, record?.patches || [], record, {
      undoable: record?.toolId !== 'terrain.sample',
      inversePatches
    });
    return;
  }
  transaction.toolId = record.toolId || transaction.toolId;
  transaction.patches.push(...cloneJson(record.patches));
  transaction.inversePatches = cloneJson(inversePatches || []).concat(transaction.inversePatches);
  transaction.events.push({
    type: eventType,
    patchCount: record.patches.length,
    metadata: cloneJson(record.metadata || null)
  });
  for (const patch of record.patches) transaction.touchedPaths.add(String(patch.path || ''));
}

function commitToolTransaction(transaction) {
  if (!transaction?.patches?.length) return;
  const toolId = transaction.toolId || state.ui.activeToolId;
  recordAction(`${toolId}.transaction`, transaction.patches, {
    toolId,
    status: 'ok',
    metadata: {
      startedAt: transaction.startedAt,
      endedAt: Date.now(),
      eventCount: transaction.events.length,
      patchCount: transaction.patches.length,
      touchedPathCount: transaction.touchedPaths.size,
      events: transaction.events
    }
  }, {
    undoable: toolId !== 'terrain.sample',
    inversePatches: transaction.inversePatches
  });
}

function strokeCellsForPointer(type, cell) {
  if (state.ui.activeToolId === 'terrain.fill' || state.ui.activeToolId === 'terrain.sample') return [cell];
  const previous = type === 'pointermove' ? activePointer?.previousCell : null;
  if (!previous) return [cell];
  return bresenhamCells(previous.x, previous.z, cell.x, cell.z).map((lineCell) => ({
    x: lineCell.x,
    z: lineCell.y
  }));
}

function syncSampledSettings() {
  const settings = currentSettings(state.terrain.settings);
  state.terrain.settings = settings;
  syncControls();
}

function updateHover(screen) {
  const picked = pickTerrain(screen);
  const cell = picked.cell;
  const previous = state.ui.hoverCell;
  state.ui.hoverCell = cell;
  if (!previous || previous.x !== cell.x || previous.z !== cell.z) lineDirty = true;
  const terrainCell = readTerrainCell(renderTerrainCells(), cell.x, cell.z);
  elements.statusCell.textContent = `${cell.x},${cell.z}`;
  elements.statusHeight.textContent = String(terrainCell?.height || 0);
}

function applyPatches(patches) {
  const inverse = [];
  for (const patch of patches || []) {
    const inversePatch = applyPatch(state, patch);
    if (inversePatch) inverse.unshift(inversePatch);
  }
  return inverse;
}

function applyPatch(root, patch) {
  const segments = String(patch.path || '').split('/').filter(Boolean);
  if (!segments.length) return null;
  let target = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!target[segment] || typeof target[segment] !== 'object') target[segment] = {};
    target = target[segment];
  }
  const key = segments[segments.length - 1];
  const existed = Object.prototype.hasOwnProperty.call(target, key);
  const oldValue = existed ? cloneJson(target[key]) : undefined;
  const inverse = existed
    ? { op: 'set', path: patch.path, value: oldValue }
    : { op: 'remove', path: patch.path };
  if (patch.op === 'remove') {
    delete target[key];
    return inverse;
  }
  if (patch.op === 'assign') {
    target[key] = { ...(target[key] || {}), ...(patch.value || {}) };
    return inverse;
  }
  target[key] = cloneJson(patch.value);
  return inverse;
}

function recordAction(action, patches, record = null, options = {}) {
  const entry = {
    index: state.actions.length,
    action,
    patches: cloneJson(patches || []),
    inversePatches: Array.isArray(options.inversePatches) ? cloneJson(options.inversePatches) : [],
    record: cloneJson(record),
    undoable: options.undoable === true,
    at: Date.now(),
    camera: { ...state.canvas.session.camera },
    meshSummary: { ...state.ui.meshSummary }
  };
  state.actions.push(entry);
  state.debug.history = state.actions;
  if (options.undoable && Array.isArray(options.inversePatches) && options.inversePatches.length) {
    state.history.undoStack.push({
      action,
      patches: cloneJson(patches || []),
      inversePatches: cloneJson(options.inversePatches),
      record: cloneJson(record),
      at: Date.now()
    });
    state.history.redoStack = [];
  }
  recordDebugSnapshot(entry);
  scheduleDebugPanelSync();
  persistSnapshotSoon();
}

function recordDebugSnapshot(entry) {
  const snapshot = {
    index: state.debug.snapshots.length,
    actionIndex: entry?.index ?? -1,
    action: entry?.action ?? 'unknown',
    at: Date.now(),
    terrain: cloneJson(state.terrain.cells),
    camera: { ...state.canvas.session.camera },
    meshSummary: { ...state.ui.meshSummary },
    patches: cloneJson(entry?.patches || []),
    inversePatches: cloneJson(entry?.inversePatches || []),
    record: cloneJson(entry?.record),
    undoDepth: state.history.undoStack.length,
    redoDepth: state.history.redoStack.length,
    actionCount: state.actions.length
  };
  state.debug.snapshots.push(snapshot);
  if (!state.debug.previewMode) state.debug.selectedIndex = state.debug.snapshots.length - 1;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function readLocalSnapshot() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('state') === 'default') return null;
  try {
    const raw = window.localStorage?.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state || parsed;
  } catch {
    return null;
  }
}

function persistSnapshotSoon() {
  if (snapshotPersistTimer) window.clearTimeout(snapshotPersistTimer);
  snapshotPersistTimer = window.setTimeout(() => {
    snapshotPersistTimer = 0;
    persistSnapshotNow();
  }, 80);
}

function persistSnapshotNow() {
  const snapshot = createAppSnapshot({ includeHistory: false });
  try {
    window.localStorage?.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Persistence is useful for verifier handoff, but should never block editing.
  }
  if (window.__FRONTIER_HEIGHTFIELD_DISABLE_SERVER_PERSIST__) return;
  fetch(SNAPSHOT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: snapshot }),
    keepalive: true
  }).catch(() => {});
}

function handleHistoryHotkey(event) {
  if (isEditableEventTarget(event.target)) return false;
  const cmd = event.metaKey || event.ctrlKey;
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  if (!cmd || event.altKey) return false;
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoHistory();
    else undoHistory();
    return true;
  }
  if (key === 'y') {
    event.preventDefault();
    redoHistory();
    return true;
  }
  return false;
}

function isEditableEventTarget(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable === true;
}

function undoHistory() {
  const entry = state.history.undoStack.pop();
  if (!entry) return false;
  applyPatches(entry.inversePatches);
  state.history.redoStack.push(entry);
  markDirtyForPatches(entry.inversePatches);
  recordAction('history.undo', entry.inversePatches, {
    toolId: 'history',
    status: 'ok',
    metadata: { action: entry.action }
  });
  return true;
}

function redoHistory() {
  const entry = state.history.redoStack.pop();
  if (!entry) return false;
  applyPatches(entry.patches);
  state.history.undoStack.push(entry);
  markDirtyForPatches(entry.patches);
  recordAction('history.redo', entry.patches, {
    toolId: 'history',
    status: 'ok',
    metadata: { action: entry.action }
  });
  return true;
}

function markDirtyForPatches(patches) {
  for (const patch of patches || []) {
    if (String(patch.path || '').startsWith(CELLS_PATH)) {
      meshDirty = true;
      lineDirty = true;
    }
    if (String(patch.path || '').startsWith(CAMERA_PATH)) lineDirty = true;
  }
}

function previewDebugSnapshot(index) {
  if (!state.debug.snapshots.length) return;
  const selectedIndex = clamp(Math.trunc(index), 0, state.debug.snapshots.length - 1);
  state.debug.selectedIndex = selectedIndex;
  state.debug.previewMode = selectedIndex !== state.debug.snapshots.length - 1;
  meshDirty = true;
  lineDirty = true;
  scheduleDebugPanelSync();
}

function resumeLiveDebug() {
  state.debug.previewMode = false;
  state.debug.selectedIndex = Math.max(0, state.debug.snapshots.length - 1);
  meshDirty = true;
  lineDirty = true;
  scheduleDebugPanelSync();
}

function revertToDebugSnapshot() {
  const snapshot = state.debug.snapshots[state.debug.selectedIndex];
  if (!snapshot) return;
  state.terrain.cells = cloneJson(snapshot.terrain);
  state.canvas.session.camera = { ...snapshot.camera };
  state.debug.previewMode = false;
  meshDirty = true;
  lineDirty = true;
  recordAction('history.revert', [
    { op: 'set', path: CELLS_PATH, value: state.terrain.cells },
    { op: 'set', path: CAMERA_PATH, value: state.canvas.session.camera }
  ]);
}

function scheduleDebugPanelSync() {
  if (debugPanelSyncPending) return;
  debugPanelSyncPending = true;
  requestAnimationFrame(() => {
    debugPanelSyncPending = false;
    syncDebugPanel();
  });
}

function syncDebugPanel() {
  if (!elements.debugPanel) return;
  elements.debugPanel.classList.toggle('open', state.debug.open);
  elements.debugToggle.classList.toggle('active', state.debug.open);
  const lastIndex = Math.max(0, state.debug.snapshots.length - 1);
  const selectedIndex = Math.max(0, Math.min(state.debug.selectedIndex, lastIndex));
  elements.debugTimeline.max = String(lastIndex);
  elements.debugTimeline.value = String(selectedIndex);
  const snapshot = state.debug.snapshots[selectedIndex];
  elements.debugLabel.textContent = snapshot
    ? `${selectedIndex}/${lastIndex} ${state.debug.previewMode ? 'preview' : 'live'}`
    : '0/0 live';
  elements.debugAction.textContent = snapshot ? snapshot.action : 'initializing';
  elements.debugPatches.textContent = snapshot ? formatDebugJson(snapshot.patches) : '[]';
  if (elements.debugHistory) {
    const selectedActionIndex = snapshot ? Math.max(0, snapshot.actionIndex) : 0;
    const start = Math.max(0, selectedActionIndex - DEBUG_HISTORY_PREVIEW_RADIUS);
    const end = Math.min(state.actions.length, selectedActionIndex + DEBUG_HISTORY_PREVIEW_RADIUS + 1);
    const history = state.actions.slice(start, end).map((entry) => ({
      index: entry.index,
      action: entry.action,
      at: entry.at,
      undoable: entry.undoable,
      patchCount: entry.patches.length,
      inversePatchCount: entry.inversePatches.length,
      record: summarizeRecord(entry.record)
    }));
    elements.debugHistory.textContent = formatDebugJson({
      total: state.actions.length,
      selectedActionIndex,
      window: [start, Math.max(start, end - 1)],
      entries: history
    });
  }
  elements.debugState.textContent = snapshot ? formatDebugJson({
    camera: snapshot.camera,
    mesh: snapshot.meshSummary,
    record: summarizeRecord(snapshot.record),
    inversePatches: snapshot.inversePatches,
    undoDepth: snapshot.undoDepth,
    redoDepth: snapshot.redoDepth,
    actionCount: snapshot.actionCount,
    cells: Object.keys(snapshot.terrain || {}).length
  }) : '{}';
}

function summarizeRecord(record) {
  if (!record || typeof record !== 'object') return record || null;
  return {
    toolId: record.toolId,
    status: record.status,
    patchCount: Array.isArray(record.patches) ? record.patches.length : 0,
    metadata: record.metadata || null
  };
}

function formatDebugJson(value) {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= DEBUG_JSON_TEXT_LIMIT) return text;
  return JSON.stringify({
    truncated: true,
    length: text.length,
    preview: text.slice(0, DEBUG_JSON_TEXT_LIMIT)
  }, null, 2);
}

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    state.canvas.session.viewport = {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      dpr,
      left: 0,
      top: 0
    };
    lineDirty = true;
  }
}

function fitCameraToTerrain() {
  const bounds = terrainBounds(state.terrain.cells);
  const viewport = state.canvas.session.viewport;
  const padding = 1.25;
  const zoom = clamp(
    Math.min(
      viewport.width / (bounds.width + padding),
      (viewport.height * CAMERA_GROUND_Y_SCALE) / (bounds.depth + padding)
    ) * 1.14,
    state.canvas.session.camera.minZoom,
    state.canvas.session.camera.maxZoom
  );
  const worldWidth = Math.max(1, viewport.width / zoom);
  const worldHeight = Math.max(1, viewport.height / zoom);
  const groundDepth = worldHeight / CAMERA_GROUND_Y_SCALE;
  state.canvas.session.camera.zoom = zoom;
  state.canvas.session.camera.x = bounds.x + bounds.width * 0.5 - worldWidth * 0.5;
  state.canvas.session.camera.y = bounds.z + bounds.depth * 0.5 - groundDepth * 0.5;
  lineDirty = true;
}

function activeDebugSnapshot() {
  if (!state.debug.previewMode) return null;
  return state.debug.snapshots[state.debug.selectedIndex] || null;
}

function renderTerrainCells() {
  return activeDebugSnapshot()?.terrain || state.terrain.cells;
}

function renderCamera() {
  return activeDebugSnapshot()?.camera || state.canvas.session.camera;
}

function frame(now) {
  resize();
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (meshDirty) {
    const mesh = buildTerrainMesh(renderTerrainCells());
    renderer.uploadMesh(mesh);
    state.ui.meshSummary = mesh.summary;
    elements.statusMesh.textContent = `${mesh.summary.triangleCount} tris`;
    meshDirty = false;
    lineDirty = true;
  }
  if (lineDirty) {
    renderer.uploadGridLines(buildGridLineVertices());
    renderer.uploadOverlayLines(buildOverlayLineVertices());
    lineDirty = false;
  }
  renderer.render({
    camera: renderCamera(),
    viewport: state.canvas.session.viewport,
    lighting: state.canvas.session.lighting,
    time: now / 1000,
    dt
  });
  requestAnimationFrame(frame);
}

function buildGridLineVertices() {
  const out = [];
  const camera = renderCamera();
  const viewport = {
    ...state.canvas.session.viewport,
    height: state.canvas.session.viewport.height / CAMERA_GROUND_Y_SCALE
  };
  const grid = materializeCanvasGrid(camera, viewport, state.canvas.session.grid);
  const z0 = grid.worldRect.y - 2;
  const z1 = grid.worldRect.y + grid.worldRect.height + 2;
  const x0 = grid.worldRect.x - 2;
  const x1 = grid.worldRect.x + grid.worldRect.width + 2;
  for (const line of grid.vertical) {
    const color = line.major ? [0.34, 0.43, 0.49, 0.17] : [0.22, 0.28, 0.32, 0.06];
    pushLine(out, [line.world, 0.018, z0], [line.world, 0.018, z1], color);
  }
  for (const line of grid.horizontal) {
    const color = line.major ? [0.34, 0.43, 0.49, 0.17] : [0.22, 0.28, 0.32, 0.06];
    pushLine(out, [x0, 0.018, line.world], [x1, 0.018, line.world], color);
  }
  return new Float32Array(out);
}

function buildOverlayLineVertices() {
  const out = [];
  if (state.ui.previewCells.length) {
    const y = state.ui.previewHeight * HEIGHT_UNIT + 0.075;
    for (const cell of state.ui.previewCells) pushCellOutline(out, cell, y, [0.98, 0.86, 0.28, 0.9]);
  } else {
    const hover = state.ui.hoverCell;
    if (hover && state.ui.activeToolId !== 'canvas.pan') {
    const settings = currentSettings();
    const cells = brushCells(hover, settings.brushSize);
    for (const cell of cells) {
      const terrainCell = readTerrainCell(renderTerrainCells(), cell.x, cell.z);
      const y = ((terrainCell?.height || 0) * HEIGHT_UNIT) + 0.055;
      const color = state.ui.activeToolId === 'terrain.lower' || state.ui.activeToolId === 'terrain.erase'
        ? [1, 0.32, 0.25, 0.95]
        : state.ui.activeToolId === 'terrain.sample'
          ? [0.44, 0.88, 1, 0.95]
          : state.ui.activeToolId === 'terrain.path' || state.ui.activeToolId === 'terrain.stairs'
            ? [0.62, 0.72, 1, 0.95]
          : state.ui.activeToolId === 'terrain.fill'
            ? [0.35, 1, 0.66, 0.95]
          : [0.98, 0.86, 0.28, 0.95];
        pushCellOutline(out, cell, y, color);
      }
    }
  }
  return new Float32Array(out);
}

function pushCellOutline(out, cell, y, color) {
  pushLine(out, [cell.x, y, cell.z], [cell.x + 1, y, cell.z], color);
  pushLine(out, [cell.x + 1, y, cell.z], [cell.x + 1, y, cell.z + 1], color);
  pushLine(out, [cell.x + 1, y, cell.z + 1], [cell.x, y, cell.z + 1], color);
  pushLine(out, [cell.x, y, cell.z + 1], [cell.x, y, cell.z], color);
}

function pushLine(out, a, b, color) {
  out.push(a[0], a[1], a[2], color[0], color[1], color[2], color[3]);
  out.push(b[0], b[1], b[2], color[0], color[1], color[2], color[3]);
}

function rebuildAtlasTextureSoon() {
  if (atlasRebuildTimer) window.clearTimeout(atlasRebuildTimer);
  atlasRebuildTimer = window.setTimeout(() => {
    atlasRebuildTimer = 0;
    void rebuildAtlasTextureNow();
  }, 40);
}

async function rebuildAtlasTextureNow() {
  if (!renderer || atlasRebuildPending) return;
  atlasRebuildPending = true;
  try {
    const texture = await createAtlasTexture(gl);
    renderer.setAtlas(texture);
    meshDirty = true;
    lineDirty = true;
  } finally {
    atlasRebuildPending = false;
  }
}

function createRenderer(gl, atlas) {
  const meshProgram = createProgram(gl, MESH_VS, MESH_FS);
  const lineProgram = createProgram(gl, LINE_VS, LINE_FS);
  let atlasTexture = atlas;
  const meshVao = gl.createVertexArray();
  const meshPosition = gl.createBuffer();
  const meshNormal = gl.createBuffer();
  const meshUv = gl.createBuffer();
  const meshShade = gl.createBuffer();
  const meshIndex = gl.createBuffer();
  const gridLines = createLineLayer(gl);
  const overlayLines = createLineLayer(gl);
  let indexCount = 0;
  let indexType = gl.UNSIGNED_SHORT;

  gl.bindVertexArray(meshVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, meshPosition);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, meshNormal);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, meshUv);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, meshShade);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndex);
  gl.bindVertexArray(null);

  return {
    uploadMesh(mesh) {
      indexCount = mesh.indices.length;
      indexType = mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bindBuffer(gl.ARRAY_BUFFER, meshPosition);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, meshNormal);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, meshUv);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.uvs, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, meshShade);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.shades, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, meshIndex);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW);
    },
    uploadGridLines(vertices) {
      uploadLineLayer(gl, gridLines, vertices);
    },
    uploadOverlayLines(vertices) {
      uploadLineLayer(gl, overlayLines, vertices);
    },
    uploadLines(vertices) {
      uploadLineLayer(gl, overlayLines, vertices);
    },
    setAtlas(nextAtlas) {
      if (!nextAtlas || nextAtlas === atlasTexture) return;
      const previous = atlasTexture;
      atlasTexture = nextAtlas;
      if (previous) gl.deleteTexture(previous);
    },
    render({ camera, viewport, lighting, time }) {
      const matrices = cameraMatrices(camera, viewport);
      const light = normalizeLighting(lighting);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0.045, 0.058, 0.071, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(lineProgram.program);
      gl.uniformMatrix4fv(lineProgram.uniforms.u_viewProjection, false, matrices.viewProjection);
      drawLineLayer(gl, gridLines);
      gl.disable(gl.BLEND);

      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(meshProgram.program);
      gl.uniformMatrix4fv(meshProgram.uniforms.u_viewProjection, false, matrices.viewProjection);
      gl.uniform3f(meshProgram.uniforms.u_lightDir, -0.34, 0.82, 0.46);
      gl.uniform3f(meshProgram.uniforms.u_fillDir, 0.58, 0.36, -0.68);
      gl.uniform1f(meshProgram.uniforms.u_exposure, light.exposure / 100);
      gl.uniform1f(meshProgram.uniforms.u_wallContrast, light.wallContrast / 100);
      gl.uniform1f(meshProgram.uniforms.u_edgeStrength, light.edgeStrength / 100);
      gl.uniform1f(meshProgram.uniforms.u_shadowStrength, light.shadowStrength / 100);
      gl.uniform1f(meshProgram.uniforms.u_time, time);
      gl.uniform1f(meshProgram.uniforms.u_atlasCols, MATERIALS.length);
      gl.uniform1f(meshProgram.uniforms.u_atlasRows, ATLAS_ROWS);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.uniform1i(meshProgram.uniforms.u_atlas, 0);
      gl.bindVertexArray(meshVao);
      if (indexCount > 0) gl.drawElements(gl.TRIANGLES, indexCount, indexType, 0);
      gl.bindVertexArray(null);

      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(lineProgram.program);
      gl.uniformMatrix4fv(lineProgram.uniforms.u_viewProjection, false, matrices.viewProjection);
      drawLineLayer(gl, overlayLines);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
  };
}

function createLineLayer(gl) {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);
  return { vao, buffer, vertexCount: 0 };
}

function uploadLineLayer(gl, layer, vertices) {
  layer.vertexCount = vertices.length / 7;
  gl.bindBuffer(gl.ARRAY_BUFFER, layer.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
}

function drawLineLayer(gl, layer) {
  gl.bindVertexArray(layer.vao);
  if (layer.vertexCount > 0) gl.drawArrays(gl.LINES, 0, layer.vertexCount);
  gl.bindVertexArray(null);
}

function pickGround(screen) {
  const ray = screenRay(screen);
  return intersectRayY(ray, 0);
}

function pickTerrain(screen) {
  const ray = screenRay(screen);
  const cells = renderTerrainCells();
  const maxHeight = maxTerrainHeight(cells);
  for (let height = maxHeight; height >= 1; height -= 1) {
    const hit = intersectRayY(ray, height * HEIGHT_UNIT);
    const cell = { x: Math.floor(hit.x), z: Math.floor(hit.z) };
    const terrainCell = readTerrainCell(cells, cell.x, cell.z);
    if (
      terrainCell &&
      terrainCell.height >= height &&
      terrainFootprintContainsPointAtLayer(cells, cell.x, cell.z, height, hit.x, hit.z)
    ) {
      return {
        x: hit.x,
        y: hit.y,
        z: hit.z,
        cell
      };
    }
  }
  const ground = intersectRayY(ray, 0);
  return {
    x: ground.x,
    y: ground.y,
    z: ground.z,
    cell: { x: Math.floor(ground.x), z: Math.floor(ground.z) }
  };
}

function maxTerrainHeight(cells) {
  let max = 0;
  for (const [key, raw] of Object.entries(cells || {})) {
    const { x, z } = parseCellKey(key);
    const cell = readTerrainCell({ [key]: raw }, x, z);
    if (cell?.height > max) max = cell.height;
  }
  return max;
}

function screenRay(screen) {
  const matrices = cameraMatrices(state.canvas.session.camera, state.canvas.session.viewport);
  const width = Math.max(1, state.canvas.session.viewport.width);
  const height = Math.max(1, state.canvas.session.viewport.height);
  const x = (screen.x / width) * 2 - 1;
  const y = 1 - (screen.y / height) * 2;
  const near = transformPoint(matrices.inverseViewProjection, [x, y, -1, 1]);
  const far = transformPoint(matrices.inverseViewProjection, [x, y, 1, 1]);
  return { near, far };
}

function intersectRayY(ray, y) {
  const near = ray.near;
  const far = ray.far;
  const dy = far[1] - near[1];
  const t = Math.abs(dy) < 0.00001 ? 0 : (y - near[1]) / dy;
  return {
    x: near[0] + (far[0] - near[0]) * t,
    y,
    z: near[2] + (far[2] - near[2]) * t
  };
}

function cameraMatrices(camera, viewport) {
  const worldWidth = Math.max(1, viewport.width / camera.zoom);
  const worldHeight = Math.max(1, viewport.height / camera.zoom);
  const groundDepth = worldHeight / CAMERA_GROUND_Y_SCALE;
  const target = [camera.x + worldWidth * 0.5, 0, camera.y + groundDepth * 0.5];
  const eye = [target[0], target[1] + CAMERA_TILT_HEIGHT, target[2] + CAMERA_TILT_DEPTH];
  const view = lookAt(eye, target, [0, 1, 0]);
  const projection = ortho(-worldWidth * 0.5, worldWidth * 0.5, -worldHeight * 0.5, worldHeight * 0.5, -160, 160);
  const viewProjection = multiplyMat4(projection, view);
  return {
    view,
    projection,
    viewProjection,
    inverseViewProjection: invertMat4(viewProjection)
  };
}

async function createAtlasTexture(gl) {
  const canvas = document.createElement('canvas');
  canvas.width = MATERIALS.length * 128;
  canvas.height = ATLAS_ROWS * 128;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const loadedImages = await Promise.all(TILE_SOURCE_IDS.map((id) => loadBrowserImage(TILE_SOURCE_URLS[id])));
  const tileImages = Object.fromEntries(TILE_SOURCE_IDS.map((id, index) => [id, loadedImages[index]]));
  for (let col = 0; col < MATERIALS.length; col += 1) {
    const [topSource, sideSource, bevelSource, footSource] = MATERIALS[col].split('|');
    const rowSources = [topSource, bevelSource, sideSource, footSource];
    for (let row = 0; row < ATLAS_ROWS; row += 1) {
      const sourceId = rowSources[row] || topSource;
      const image = tileImages[sourceId] || tileImages.grass;
      const x = col * 128;
      const y = row * 128;
      ctx.drawImage(image, x, y, 128, 128);
    }
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  return texture;
}

function decorateGrassTop(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(31, 70, 25, 0.18)';
  ctx.fillRect(x, y, 128, 128);
  for (let i = 0; i < 18; i += 1) {
    const px = x + 8 + ((i * 41 + 13) % 112);
    const py = y + 8 + ((i * 29 + 7) % 112);
    const rx = 8 + ((i * 5) % 16);
    const ry = 5 + ((i * 7) % 12);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(12, 70, 30, 0.2)' : 'rgba(112, 164, 52, 0.1)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, ((i * 19) % 90) * Math.PI / 180, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(228, 255, 145, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i += 1) {
    const px = x + 6 + ((i * 23 + 5) % 116);
    const py = y + 8 + ((i * 37 + 11) % 112);
    ctx.beginPath();
    ctx.moveTo(px, py + 4);
    ctx.lineTo(px + ((i % 3) - 1) * 3, py - 5);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i += 1) {
    const px = x + 12 + ((i * 47 + 17) % 104);
    const py = y + 16 + ((i * 31 + 23) % 96);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(238, 219, 255, 0.42)' : 'rgba(255, 240, 132, 0.36)';
    ctx.fillRect(px, py, 2, 2);
    ctx.fillRect(px + 2, py + 1, 1, 1);
  }
  ctx.restore();
}

function decorateGrassCliffSide(ctx, x, y, grassImage) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(grassImage, 0, 92, 128, 24, x, y, 128, 24);
  ctx.globalAlpha = 1;
  const moss = ctx.createLinearGradient(x, y, x, y + 34);
  moss.addColorStop(0, 'rgba(68, 138, 58, 0.42)');
  moss.addColorStop(0.55, 'rgba(45, 104, 42, 0.22)');
  moss.addColorStop(1, 'rgba(23, 55, 28, 0)');
  ctx.fillStyle = moss;
  ctx.fillRect(x, y, 128, 38);
  ctx.fillStyle = 'rgba(24, 61, 31, 0.45)';
  for (let i = 0; i < 17; i += 1) {
    const px = x + ((i * 29 + 11) % 128);
    const length = 8 + ((i * 7) % 22);
    ctx.fillRect(px, y + 12 + ((i * 5) % 8), 2 + (i % 2), length);
  }
  drawCliffCracks(ctx, x, y, {
    count: 12,
    dark: 'rgba(20, 24, 22, 0.28)',
    light: 'rgba(194, 214, 168, 0.14)'
  });
  ctx.fillStyle = 'rgba(17, 22, 19, 0.2)';
  for (let i = 0; i < 8; i += 1) {
    const px = x + 14 + ((i * 37) % 100);
    const py = y + 44 + ((i * 19) % 62);
    ctx.beginPath();
    ctx.ellipse(px, py, 3 + (i % 3), 2 + (i % 2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function decorateStoneSide(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let row = 22; row < 128; row += 27) ctx.fillRect(x, y + row, 128, 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const px = x + 18 + i * 23;
    ctx.beginPath();
    ctx.moveTo(px, y + 8);
    ctx.lineTo(px + ((i % 2) ? 7 : -5), y + 120);
    ctx.stroke();
  }
  ctx.restore();
}

function decorateGrassBevel(ctx, x, y, grassImage) {
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.drawImage(grassImage, 0, 68, 128, 40, x, y, 128, 40);
  ctx.globalAlpha = 1;
  const rim = ctx.createLinearGradient(x, y, x, y + 128);
  rim.addColorStop(0, 'rgba(239, 255, 177, 0.2)');
  rim.addColorStop(0.32, 'rgba(66, 137, 45, 0.2)');
  rim.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
  ctx.fillStyle = rim;
  ctx.fillRect(x, y, 128, 128);
  ctx.restore();
}

function drawCliffCracks(ctx, x, y, style) {
  ctx.lineCap = 'round';
  for (let i = 0; i < style.count; i += 1) {
    const px = x + 8 + ((i * 43 + 17) % 112);
    const py = y + 20 + ((i * 31 + 9) % 82);
    const h = 20 + ((i * 13) % 48);
    const bend = ((i % 5) - 2) * 3;
    ctx.strokeStyle = style.dark;
    ctx.lineWidth = 2 + (i % 2);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.bezierCurveTo(px + bend, py + h * 0.3, px - bend * 0.6, py + h * 0.72, px + bend * 0.35, py + h);
    ctx.stroke();
    ctx.strokeStyle = style.light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 2, py + 1);
    ctx.bezierCurveTo(px + bend + 2, py + h * 0.3, px - bend * 0.6 + 2, py + h * 0.72, px + bend * 0.35 + 2, py + h);
    ctx.stroke();
  }
}

function loadBrowserImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('failed to load texture asset: ' + url));
    image.src = url;
  });
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Program link failed';
    gl.deleteProgram(program);
    throw new Error(info);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Shader compile failed';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

const MESH_VS = `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;
layout(location=3) in float a_shade;

uniform mat4 u_viewProjection;

out vec3 v_normal;
out vec3 v_world;
out vec2 v_uv;
out float v_shade;

void main() {
  v_normal = a_normal;
  v_world = a_position;
  v_uv = a_uv;
  v_shade = a_shade;
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
}`;

const MESH_FS = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_world;
in vec2 v_uv;
in float v_shade;

uniform sampler2D u_atlas;
uniform vec3 u_lightDir;
uniform vec3 u_fillDir;
uniform float u_exposure;
uniform float u_wallContrast;
uniform float u_edgeStrength;
uniform float u_shadowStrength;
uniform float u_time;
uniform float u_atlasCols;
uniform float u_atlasRows;

out vec4 frag;

void main() {
  vec3 n = normalize(v_normal);
  vec4 tex = texture(u_atlas, v_uv);
  float key = fract(sin(dot(floor(v_world.xz * 7.0), vec2(12.9898, 78.233))) * 43758.5453);
  float mainLight = max(0.0, dot(n, normalize(u_lightDir)));
  float fillLight = max(0.0, dot(n, normalize(u_fillDir))) * 0.24;
  float vertical = 1.0 - smoothstep(0.08, 0.7, n.y);
  float topLift = smoothstep(0.15, 0.95, n.y) * 0.08;
  float sideLift = vertical * 0.38;
  float heightShade = clamp(v_world.y * 0.012, 0.0, 0.08);
  float light = (0.62 + mainLight * 0.34 + fillLight + topLift + sideLift + heightShade) * u_exposure;
  float shadowShade = mix(1.0, v_shade, u_shadowStrength);
  float faceShade = mix(shadowShade, max(shadowShade, 0.82), vertical * 0.5);
  vec3 color = tex.rgb * light * faceShade;
  float macro = sin(v_world.x * 0.47 + v_world.z * 0.29) * 0.5 +
    sin(v_world.x * 1.13 - v_world.z * 0.71) * 0.28 +
    sin((v_world.x + v_world.z) * 0.21) * 0.22;
  float topSurface = smoothstep(0.35, 0.95, n.y);
  color *= 1.0 + macro * 0.045 * topSurface;
  color *= 1.0 - vertical * u_wallContrast;
  vec2 tileUv = vec2(fract(v_uv.x * u_atlasCols), fract(v_uv.y * u_atlasRows));
  float edgeDist = min(min(tileUv.x, 1.0 - tileUv.x), min(tileUv.y, 1.0 - tileUv.y));
  float edge = 1.0 - smoothstep(0.006, 0.04, edgeDist);
  color *= 1.0 - edge * u_edgeStrength * mix(0.25, 0.0, smoothstep(0.1, 0.95, n.y));
  color += (key - 0.5) * 0.018;
  frag = vec4(clamp(color, 0.0, 1.0), tex.a);
}`;

const LINE_VS = `#version 300 es
layout(location=0) in vec3 a_position;
layout(location=1) in vec4 a_color;

uniform mat4 u_viewProjection;

out vec4 v_color;

void main() {
  v_color = a_color;
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
}`;

const LINE_FS = `#version 300 es
precision mediump float;

in vec4 v_color;
out vec4 frag;

void main() {
  frag = v_color;
}`;

try {
  await loadBlobMaskPolygonAtlas({
    blob: '/assets/grey-blob-mask.png',
    curvy: '/assets/grey-blob-mask-curvy.png'
  });
} catch (error) {
  console.warn(error);
}

const atlasTexture = await createAtlasTexture(gl);
renderer = createRenderer(gl, atlasTexture);
bindUi();
resize();
fitCameraToTerrain();
recordAction('initial.state', [], null);
syncControls();
syncDebugPanel();
requestAnimationFrame(frame);

function ortho(left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  return new Float32Array([
    -2 * lr, 0, 0, 0,
    0, -2 * bt, 0, 0,
    0, 0, 2 * nf, 0,
    (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
  ]);
}

function lookAt(eye, target, up) {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dotArray(x, eye), -dotArray(y, eye), -dotArray(z, eye), 1
  ]);
}

function multiplyMat4(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function invertMat4(m) {
  const out = new Float32Array(16);
  const b00 = m[0] * m[5] - m[1] * m[4];
  const b01 = m[0] * m[6] - m[2] * m[4];
  const b02 = m[0] * m[7] - m[3] * m[4];
  const b03 = m[1] * m[6] - m[2] * m[5];
  const b04 = m[1] * m[7] - m[3] * m[5];
  const b05 = m[2] * m[7] - m[3] * m[6];
  const b06 = m[8] * m[13] - m[9] * m[12];
  const b07 = m[8] * m[14] - m[10] * m[12];
  const b08 = m[8] * m[15] - m[11] * m[12];
  const b09 = m[9] * m[14] - m[10] * m[13];
  const b10 = m[9] * m[15] - m[11] * m[13];
  const b11 = m[10] * m[15] - m[11] * m[14];
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return new Float32Array(16);
  det = 1 / det;
  out[0] = (m[5] * b11 - m[6] * b10 + m[7] * b09) * det;
  out[1] = (m[2] * b10 - m[1] * b11 - m[3] * b09) * det;
  out[2] = (m[13] * b05 - m[14] * b04 + m[15] * b03) * det;
  out[3] = (m[10] * b04 - m[9] * b05 - m[11] * b03) * det;
  out[4] = (m[6] * b08 - m[4] * b11 - m[7] * b07) * det;
  out[5] = (m[0] * b11 - m[2] * b08 + m[3] * b07) * det;
  out[6] = (m[14] * b02 - m[12] * b05 - m[15] * b01) * det;
  out[7] = (m[8] * b05 - m[10] * b02 + m[11] * b01) * det;
  out[8] = (m[4] * b10 - m[5] * b08 + m[7] * b06) * det;
  out[9] = (m[1] * b08 - m[0] * b10 - m[3] * b06) * det;
  out[10] = (m[12] * b04 - m[13] * b02 + m[15] * b00) * det;
  out[11] = (m[9] * b02 - m[8] * b04 - m[11] * b00) * det;
  out[12] = (m[5] * b07 - m[4] * b09 - m[6] * b06) * det;
  out[13] = (m[0] * b09 - m[1] * b07 + m[2] * b06) * det;
  out[14] = (m[13] * b01 - m[12] * b03 - m[14] * b00) * det;
  out[15] = (m[8] * b03 - m[9] * b01 + m[10] * b00) * det;
  return out;
}

function transformPoint(m, v) {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const w = v[3];
  const out = [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w
  ];
  const invW = out[3] ? 1 / out[3] : 1;
  return [out[0] * invW, out[1] * invW, out[2] * invW, 1];
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dotArray(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
