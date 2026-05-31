import type { JsonObject, JsonValue } from '@shapeshift-labs/frontier';
import {
  createFrontierRegistryGraph,
  normalizeFrontierRegistryPath,
  type FrontierRegistryEdge,
  type FrontierRegistryEntry,
  type FrontierRegistryGraph,
  type FrontierRegistryImpact,
  type FrontierRegistryImpactInput,
  type FrontierRegistryPath,
  type FrontierRegistrySource
} from '@shapeshift-labs/frontier/registry';

export const FRONTIER_CANVAS_SURFACE_KIND = 'frontier.canvas.surface';
export const FRONTIER_CANVAS_SURFACE_VERSION = 1;
export const FRONTIER_CANVAS_FRAME_KIND = 'frontier.canvas.frame';
export const FRONTIER_CANVAS_FRAME_VERSION = 1;
export const FRONTIER_CANVAS_TOOL_KIND = 'frontier.canvas.tool';
export const FRONTIER_CANVAS_TOOL_VERSION = 1;
export const FRONTIER_CANVAS_TOOL_RECORD_KIND = 'frontier.canvas.tool-record';
export const FRONTIER_CANVAS_TOOL_RECORD_VERSION = 1;
export const FRONTIER_CANVAS_PLAN_KIND = 'frontier.canvas.plan';
export const FRONTIER_CANVAS_PLAN_VERSION = 1;
export const FRONTIER_CANVAS_PROOF_KIND = 'frontier.canvas.proof';
export const FRONTIER_CANVAS_PROOF_VERSION = 1;
export const FRONTIER_CANVAS_STATE_LAYOUT_KIND = 'frontier.canvas.state-layout';
export const FRONTIER_CANVAS_STATE_LAYOUT_VERSION = 1;

export type FrontierCanvasAxis = 'x' | 'y';
export type FrontierCanvasToolEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'pointercancel'
  | 'wheel'
  | 'keydown'
  | 'keyup'
  | string;
export type FrontierCanvasPatchOp = 'set' | 'add' | 'remove' | 'assign' | string;
export type FrontierCanvasToolStatus = 'ok' | 'ignored' | 'blocked' | 'error' | string;
export type FrontierCanvasHandleKind = 'resize' | 'rotate' | 'move' | 'custom' | string;
export type FrontierCanvasFitMode = 'fit' | 'fill';
export type FrontierCanvasSelectionMode = 'intersect' | 'contain';
export type FrontierCanvasCameraConstraintBehavior = 'free' | 'contain';
export type FrontierCanvasHitAreaKind = 'rect' | 'ellipse' | 'circle' | 'polygon' | string;
export type FrontierCanvasToolControlType = 'toggle' | 'number' | 'select' | 'text' | 'color' | string;
export type FrontierCanvasStateScope = 'crdt' | 'local';
export type FrontierCanvasStateRole =
  | 'document'
  | 'items'
  | 'layers'
  | 'documentMetadata'
  | 'session'
  | 'camera'
  | 'viewport'
  | 'grid'
  | 'activeTool'
  | 'selection'
  | 'hover'
  | 'pointer'
  | 'sessionMetadata'
  | 'custom'
  | string;

export interface FrontierCanvasPoint {
  x: number;
  y: number;
}

export interface FrontierCanvasSize {
  width: number;
  height: number;
}

export interface FrontierCanvasRect extends FrontierCanvasPoint, FrontierCanvasSize {}

export interface FrontierCanvasPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type FrontierCanvasPaddingInput = number | (Partial<FrontierCanvasPadding> & {
  x?: number;
  y?: number;
});

export interface FrontierCanvasViewport extends FrontierCanvasSize {
  dpr: number;
  left: number;
  top: number;
}

export interface FrontierCanvasCamera {
  x: number;
  y: number;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  anchorX?: number;
  anchorY?: number;
  metadata?: JsonObject;
}

export interface FrontierCanvasCameraConstraintsInput {
  bounds?: FrontierCanvasRect;
  padding?: FrontierCanvasPaddingInput;
  minZoom?: number;
  maxZoom?: number;
  behavior?: FrontierCanvasCameraConstraintBehavior;
  metadata?: unknown;
}

export interface FrontierCanvasGridInput {
  enabled?: boolean;
  size?: number;
  subdivisions?: number;
  majorEvery?: number;
  originX?: number;
  originY?: number;
  snap?: boolean;
  snapX?: boolean;
  snapY?: boolean;
  maxLines?: number;
  minScreenStep?: number;
  metadata?: unknown;
}

export interface FrontierCanvasGrid {
  enabled: boolean;
  size: number;
  subdivisions: number;
  majorEvery: number;
  originX: number;
  originY: number;
  snap: boolean;
  snapX: boolean;
  snapY: boolean;
  maxLines: number;
  minScreenStep: number;
  metadata?: JsonObject;
}

export interface FrontierCanvasLayerInput {
  id: string;
  title?: string;
  visible?: boolean;
  locked?: boolean;
  order?: number;
  metadata?: unknown;
}

export interface FrontierCanvasLayer {
  id: string;
  title?: string;
  visible: boolean;
  locked: boolean;
  order: number;
  metadata?: JsonObject;
}

export interface FrontierCanvasHitAreaInput {
  kind?: FrontierCanvasHitAreaKind;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  radius?: number;
  points?: readonly FrontierCanvasPoint[];
  tolerance?: number;
  metadata?: unknown;
}

export interface FrontierCanvasHitArea {
  kind: FrontierCanvasHitAreaKind;
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  radius?: number;
  points: FrontierCanvasPoint[];
  tolerance: number;
  metadata?: JsonObject;
}

export interface FrontierCanvasItemInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer?: string;
  z?: number;
  visible?: boolean;
  locked?: boolean;
  selectable?: boolean;
  tags?: readonly string[];
  hitArea?: FrontierCanvasHitAreaInput;
  value?: unknown;
  metadata?: unknown;
}

export interface FrontierCanvasItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layer?: string;
  z: number;
  visible: boolean;
  locked: boolean;
  selectable: boolean;
  tags: string[];
  hitArea?: FrontierCanvasHitArea;
  value?: JsonValue;
  metadata?: JsonObject;
}

export interface FrontierCanvasDocumentInput {
  id?: string;
  title?: string;
  items?: readonly FrontierCanvasItemInput[];
  layers?: readonly FrontierCanvasLayerInput[];
  metadata?: unknown;
}

export interface FrontierCanvasDocument {
  id: string;
  title?: string;
  items: FrontierCanvasItem[];
  layers: FrontierCanvasLayer[];
  metadata?: JsonObject;
}

export interface FrontierCanvasPointerState {
  pointerId?: string | number;
  screen?: FrontierCanvasPoint;
  world?: FrontierCanvasPoint;
  startScreen?: FrontierCanvasPoint;
  startWorld?: FrontierCanvasPoint;
  buttons?: number;
  metadata?: JsonObject;
}

export interface FrontierCanvasSessionInput {
  camera?: Partial<FrontierCanvasCamera>;
  viewport?: Partial<FrontierCanvasViewport>;
  grid?: FrontierCanvasGridInput;
  activeToolId?: string;
  selectedIds?: readonly string[];
  hoverId?: string | null;
  pointer?: FrontierCanvasPointerState | null;
  metadata?: unknown;
}

export interface FrontierCanvasSession {
  camera: FrontierCanvasCamera;
  viewport: FrontierCanvasViewport;
  grid: FrontierCanvasGrid;
  activeToolId?: string;
  selectedIds: string[];
  hoverId?: string | null;
  pointer?: FrontierCanvasPointerState | null;
  metadata?: JsonObject;
}

export interface FrontierCanvasSurfaceInput {
  id?: string;
  title?: string;
  package?: string;
  feature?: string;
  owner?: string;
  document?: FrontierCanvasDocumentInput;
  session?: FrontierCanvasSessionInput;
  tools?: readonly (FrontierCanvasToolInput | FrontierCanvasTool)[];
  statePath?: FrontierRegistryPath | string;
  source?: FrontierRegistrySource;
  tags?: readonly string[];
  metadata?: unknown;
}

export interface FrontierCanvasSurface {
  kind: typeof FRONTIER_CANVAS_SURFACE_KIND;
  version: typeof FRONTIER_CANVAS_SURFACE_VERSION;
  id: string;
  title?: string;
  package?: string;
  feature?: string;
  owner?: string;
  statePath: string;
  document: FrontierCanvasDocument;
  session: FrontierCanvasSession;
  tools: FrontierCanvasTool[];
  source?: FrontierRegistrySource;
  tags: string[];
  metadata?: JsonObject;
  summary: FrontierCanvasSummary;
}

export interface FrontierCanvasStateScopeInput {
  document?: FrontierCanvasStateScope;
  items?: FrontierCanvasStateScope;
  layers?: FrontierCanvasStateScope;
  documentMetadata?: FrontierCanvasStateScope;
  session?: FrontierCanvasStateScope;
  camera?: FrontierCanvasStateScope;
  viewport?: FrontierCanvasStateScope;
  grid?: FrontierCanvasStateScope;
  activeTool?: FrontierCanvasStateScope;
  selection?: FrontierCanvasStateScope;
  hover?: FrontierCanvasStateScope;
  pointer?: FrontierCanvasStateScope;
  sessionMetadata?: FrontierCanvasStateScope;
  [role: string]: FrontierCanvasStateScope | undefined;
}

export interface FrontierCanvasStatePathInput {
  id: string;
  path: FrontierRegistryPath | string;
  role?: FrontierCanvasStateRole;
  scope?: FrontierCanvasStateScope;
  ephemeral?: boolean;
  description?: string;
  metadata?: unknown;
}

export interface FrontierCanvasStatePath {
  id: string;
  path: string;
  role: FrontierCanvasStateRole;
  scope: FrontierCanvasStateScope;
  syncable: boolean;
  localOnly: boolean;
  ephemeral: boolean;
  description?: string;
  metadata?: JsonObject;
}

export interface FrontierCanvasStateLayoutInput {
  rootPath?: FrontierRegistryPath | string;
  statePath?: FrontierRegistryPath | string;
  scopes?: FrontierCanvasStateScopeInput;
  extraPaths?: readonly FrontierCanvasStatePathInput[];
  metadata?: unknown;
}

export interface FrontierCanvasStateLayout {
  kind: typeof FRONTIER_CANVAS_STATE_LAYOUT_KIND;
  version: typeof FRONTIER_CANVAS_STATE_LAYOUT_VERSION;
  rootPath: string;
  documentPath: string;
  sessionPath: string;
  paths: FrontierCanvasStatePath[];
  crdtPaths: string[];
  localPaths: string[];
  syncablePaths: string[];
  localOnlyPaths: string[];
  ephemeralPaths: string[];
  metadata?: JsonObject;
}

export interface FrontierCanvasPatchPartition {
  crdt: FrontierCanvasPatch[];
  local: FrontierCanvasPatch[];
  unknown: FrontierCanvasPatch[];
}

export interface FrontierCanvasSummary {
  itemCount: number;
  visibleItemCount: number;
  layerCount: number;
  toolCount: number;
  selectedCount: number;
  lockedItemCount: number;
}

export interface FrontierCanvasGridLine {
  axis: FrontierCanvasAxis;
  world: number;
  screen: number;
  major: boolean;
}

export interface FrontierCanvasGridMaterialization {
  kind: 'frontier.canvas.grid';
  version: 1;
  enabled: boolean;
  size: number;
  step: number;
  majorEvery: number;
  worldRect: FrontierCanvasRect;
  vertical: FrontierCanvasGridLine[];
  horizontal: FrontierCanvasGridLine[];
  skipped: boolean;
}

export interface FrontierCanvasFrameItem extends FrontierCanvasItem {
  screen: FrontierCanvasRect;
  selected: boolean;
  hovered: boolean;
}

export interface FrontierCanvasHandle {
  id: string;
  itemId: string;
  kind: FrontierCanvasHandleKind;
  edge?: string;
  world: FrontierCanvasPoint;
  screen: FrontierCanvasPoint;
  cursor?: string;
  metadata?: JsonObject;
}

export interface FrontierCanvasFrameInput {
  surface?: FrontierCanvasSurface | FrontierCanvasSurfaceInput;
  document?: FrontierCanvasDocument | FrontierCanvasDocumentInput;
  session?: FrontierCanvasSession | FrontierCanvasSessionInput;
  items?: readonly FrontierCanvasItemInput[];
  layers?: readonly FrontierCanvasLayerInput[];
  camera?: Partial<FrontierCanvasCamera>;
  viewport?: Partial<FrontierCanvasViewport>;
  grid?: FrontierCanvasGridInput;
  selectedIds?: readonly string[];
  hoverId?: string | null;
  spatialAdapter?: FrontierCanvasSpatialAdapter;
  now?: number | (() => number);
  id?: string;
  metadata?: unknown;
}

export interface FrontierCanvasSpatialAdapter {
  query(rect: FrontierCanvasRect): readonly FrontierCanvasItemInput[];
}

export interface FrontierCanvasFrame {
  kind: typeof FRONTIER_CANVAS_FRAME_KIND;
  version: typeof FRONTIER_CANVAS_FRAME_VERSION;
  id: string;
  createdAt: number;
  camera: FrontierCanvasCamera;
  viewport: FrontierCanvasViewport;
  worldRect: FrontierCanvasRect;
  grid: FrontierCanvasGridMaterialization;
  items: FrontierCanvasFrameItem[];
  selectedIds: string[];
  hoverId?: string | null;
  handles: FrontierCanvasHandle[];
  summary: FrontierCanvasFrameSummary;
  metadata?: JsonObject;
}

export interface FrontierCanvasFrameSummary {
  itemCount: number;
  visibleItemCount: number;
  gridLineCount: number;
  handleCount: number;
}

export interface FrontierCanvasPatchInput {
  op?: FrontierCanvasPatchOp;
  path: FrontierRegistryPath | string;
  value?: unknown;
  oldValue?: unknown;
  metadata?: unknown;
}

export interface FrontierCanvasPatch {
  op: FrontierCanvasPatchOp;
  path: string;
  value?: JsonValue;
  oldValue?: JsonValue;
  metadata?: JsonObject;
}

export interface FrontierCanvasPlan {
  kind: typeof FRONTIER_CANVAS_PLAN_KIND;
  version: typeof FRONTIER_CANVAS_PLAN_VERSION;
  id: string;
  action: string;
  createdAt: number;
  patches: FrontierCanvasPatch[];
  reads: string[];
  writes: string[];
  expectedPatch: FrontierCanvasPatch[];
  nextCamera?: FrontierCanvasCamera;
  worldDelta?: FrontierCanvasPoint;
  metadata?: JsonObject;
}

export interface FrontierCanvasToolEvent {
  type: FrontierCanvasToolEventType;
  pointerId?: string | number;
  screen?: FrontierCanvasPoint;
  previousScreen?: FrontierCanvasPoint;
  startScreen?: FrontierCanvasPoint;
  world?: FrontierCanvasPoint;
  previousWorld?: FrontierCanvasPoint;
  startWorld?: FrontierCanvasPoint;
  delta?: FrontierCanvasPoint;
  wheelDelta?: FrontierCanvasPoint & { z?: number };
  button?: number;
  buttons?: number;
  key?: string;
  modifiers?: {
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    ctrl?: boolean;
  };
  targetId?: string;
  input?: JsonObject;
  metadata?: JsonObject;
}

export interface FrontierCanvasToolContext<TState = unknown> {
  state?: TState;
  surface?: FrontierCanvasSurface;
  document?: FrontierCanvasDocument;
  session: FrontierCanvasSession;
  camera: FrontierCanvasCamera;
  viewport: FrontierCanvasViewport;
  frame?: FrontierCanvasFrame;
  policyDecision?: unknown;
  metadata?: JsonObject;
}

export interface FrontierCanvasToolResult {
  status?: FrontierCanvasToolStatus;
  patches?: readonly FrontierCanvasPatchInput[];
  plans?: readonly FrontierCanvasPlan[];
  selectedIds?: readonly string[];
  hoverId?: string | null;
  cursor?: string;
  message?: string;
  metadata?: unknown;
}

export interface FrontierCanvasToolControlInput {
  type: FrontierCanvasToolControlType;
  id: string;
  label?: string;
  description?: string;
  title?: string;
  ariaLabel?: string;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly {
    value: unknown;
    label?: string;
    description?: string;
    metadata?: unknown;
  }[];
  metadata?: unknown;
}

export interface FrontierCanvasToolControl {
  type: FrontierCanvasToolControlType;
  id: string;
  label?: string;
  description?: string;
  title?: string;
  ariaLabel?: string;
  default?: JsonValue;
  min?: number;
  max?: number;
  step?: number;
  options: {
    value: JsonValue;
    label?: string;
    description?: string;
    metadata?: JsonObject;
  }[];
  metadata?: JsonObject;
}

export type FrontierCanvasToolHandler<TState = unknown> = (
  context: FrontierCanvasToolContext<TState>,
  event: FrontierCanvasToolEvent
) => FrontierCanvasToolResult | void;

export interface FrontierCanvasToolInput<TState = unknown> {
  id: string;
  title?: string;
  description?: string;
  icon?: string;
  cursor?: string;
  reads?: readonly (FrontierRegistryPath | string)[];
  writes?: readonly (FrontierRegistryPath | string)[];
  requires?: readonly string[];
  events?: readonly FrontierCanvasToolEventType[];
  modes?: readonly string[];
  priority?: number;
  controls?: readonly FrontierCanvasToolControlInput[];
  expectedPatch?: readonly FrontierCanvasPatchInput[];
  rollbackToolId?: string;
  metadata?: unknown;
  handlers?: Partial<Record<FrontierCanvasToolEventType, FrontierCanvasToolHandler<TState>>>;
}

export interface FrontierCanvasTool<TState = unknown> {
  kind: typeof FRONTIER_CANVAS_TOOL_KIND;
  version: typeof FRONTIER_CANVAS_TOOL_VERSION;
  id: string;
  title: string;
  description?: string;
  icon?: string;
  cursor?: string;
  reads: string[];
  writes: string[];
  requires: string[];
  events: string[];
  modes: string[];
  priority: number;
  controls: FrontierCanvasToolControl[];
  expectedPatch: FrontierCanvasPatch[];
  rollbackToolId?: string;
  metadata?: JsonObject;
  handlers: ReadonlyMap<string, FrontierCanvasToolHandler<TState>>;
}

export interface FrontierCanvasToolRegistry<TState = unknown> {
  readonly kind: 'frontier.canvas.tool-registry';
  readonly version: 1;
  readonly size: number;
  activeToolId?: string;
  register(tool: FrontierCanvasToolInput<TState> | FrontierCanvasTool<TState>): FrontierCanvasTool<TState>;
  get(id: string): FrontierCanvasTool<TState> | undefined;
  list(): FrontierCanvasTool<TState>[];
  dispatch(request: FrontierCanvasToolDispatchRequest<TState>): FrontierCanvasToolRecord;
}

export interface FrontierCanvasToolRegistryInput<TState = unknown> {
  tools?: readonly (FrontierCanvasToolInput<TState> | FrontierCanvasTool<TState>)[];
  activeToolId?: string;
}

export interface FrontierCanvasToolDispatchRequest<TState = unknown> {
  toolId?: string;
  event: FrontierCanvasToolEvent;
  context: FrontierCanvasToolContext<TState>;
  now?: number | (() => number);
  metadata?: unknown;
}

export interface FrontierCanvasToolRecord {
  kind: typeof FRONTIER_CANVAS_TOOL_RECORD_KIND;
  version: typeof FRONTIER_CANVAS_TOOL_RECORD_VERSION;
  id: string;
  toolId: string;
  eventType: string;
  status: FrontierCanvasToolStatus;
  createdAt: number;
  patches: FrontierCanvasPatch[];
  plans: FrontierCanvasPlan[];
  reads: string[];
  writes: string[];
  requires: string[];
  message?: string;
  metadata?: JsonObject;
}

export interface FrontierCanvasHitTestInput {
  frame?: FrontierCanvasFrame;
  items?: readonly (FrontierCanvasFrameItem | FrontierCanvasItemInput)[];
  point: FrontierCanvasPoint;
  coordinate?: 'screen' | 'world';
  tolerance?: number;
  selectableOnly?: boolean;
  includeLocked?: boolean;
}

export interface FrontierCanvasHit {
  id: string;
  item: FrontierCanvasItem | FrontierCanvasFrameItem;
  distance: number;
  local: FrontierCanvasPoint;
}

export interface FrontierCanvasSelectionInRectInput {
  frame?: FrontierCanvasFrame;
  items?: readonly (FrontierCanvasFrameItem | FrontierCanvasItemInput)[];
  rect: FrontierCanvasRect;
  mode?: FrontierCanvasSelectionMode;
  selectableOnly?: boolean;
  includeLocked?: boolean;
  includeInvisible?: boolean;
  layerIds?: readonly string[];
  tags?: readonly string[];
}

export interface FrontierCanvasWheelZoomOptions {
  step?: number;
  deltaScale?: number;
  invert?: boolean;
  invertCtrlKey?: boolean;
}

export interface FrontierCanvasProof {
  kind: typeof FRONTIER_CANVAS_PROOF_KIND;
  version: typeof FRONTIER_CANVAS_PROOF_VERSION;
  surfaceId?: string;
  generatedAt: number;
  hash: string;
  summary: FrontierCanvasSummary | FrontierCanvasFrameSummary;
  metadata?: JsonObject;
}

export function defineCanvasSurface(input: FrontierCanvasSurfaceInput = {}): FrontierCanvasSurface {
  return createCanvasSurface(input);
}

export function defineCanvasTool<TState = unknown>(input: FrontierCanvasToolInput<TState>): FrontierCanvasTool<TState> {
  return normalizeTool(input);
}

export function createCanvasSurface(input: FrontierCanvasSurfaceInput = {}): FrontierCanvasSurface {
  const document = normalizeDocument(input.document);
  const session = normalizeSession(input.session);
  const tools = (input.tools ?? []).map((tool) => normalizeTool(tool));
  const statePath = normalizeFrontierRegistryPath(input.statePath ?? '/canvas');
  const summary = summarizeCanvas(document, session, tools);
  return {
    kind: FRONTIER_CANVAS_SURFACE_KIND,
    version: FRONTIER_CANVAS_SURFACE_VERSION,
    id: normalizeId(input.id ?? document.id ?? 'canvas', 'canvas surface id'),
    ...(input.title ? { title: input.title } : {}),
    ...(input.package ? { package: input.package } : {}),
    ...(input.feature ? { feature: input.feature } : {}),
    ...(input.owner ? { owner: input.owner } : {}),
    statePath,
    document,
    session,
    tools,
    ...(input.source ? { source: input.source } : {}),
    tags: uniqueStrings(input.tags),
    ...optionalObject('metadata', input.metadata),
    summary
  };
}

export function createCanvasStateLayout(input: FrontierCanvasStateLayoutInput = {}): FrontierCanvasStateLayout {
  const rootPath = normalizeFrontierRegistryPath(input.rootPath ?? input.statePath ?? '/canvas');
  const scopes = input.scopes ?? {};
  const documentScope = normalizeStateScope(scopes.document, 'crdt');
  const sessionScope = normalizeStateScope(scopes.session, 'local');
  const documentPath = appendCanvasPath(rootPath, 'document');
  const sessionPath = appendCanvasPath(rootPath, 'session');
  const paths = [
    normalizeCanvasStatePath({ id: 'canvas.document', role: 'document', path: documentPath, scope: documentScope }),
    normalizeCanvasStatePath({ id: 'canvas.document.items', role: 'items', path: appendCanvasPath(documentPath, 'items'), scope: normalizeStateScope(scopes.items, documentScope) }),
    normalizeCanvasStatePath({ id: 'canvas.document.layers', role: 'layers', path: appendCanvasPath(documentPath, 'layers'), scope: normalizeStateScope(scopes.layers, documentScope) }),
    normalizeCanvasStatePath({ id: 'canvas.document.metadata', role: 'documentMetadata', path: appendCanvasPath(documentPath, 'metadata'), scope: normalizeStateScope(scopes.documentMetadata, documentScope) }),
    normalizeCanvasStatePath({ id: 'canvas.session', role: 'session', path: sessionPath, scope: sessionScope, ephemeral: sessionScope === 'local' }),
    normalizeCanvasStatePath({ id: 'canvas.session.camera', role: 'camera', path: appendCanvasPath(sessionPath, 'camera'), scope: normalizeStateScope(scopes.camera, sessionScope), ephemeral: normalizeStateScope(scopes.camera, sessionScope) === 'local' }),
    normalizeCanvasStatePath({ id: 'canvas.session.viewport', role: 'viewport', path: appendCanvasPath(sessionPath, 'viewport'), scope: normalizeStateScope(scopes.viewport, sessionScope), ephemeral: normalizeStateScope(scopes.viewport, sessionScope) === 'local' }),
    normalizeCanvasStatePath({ id: 'canvas.session.grid', role: 'grid', path: appendCanvasPath(sessionPath, 'grid'), scope: normalizeStateScope(scopes.grid, sessionScope), ephemeral: normalizeStateScope(scopes.grid, sessionScope) === 'local' }),
    normalizeCanvasStatePath({ id: 'canvas.session.activeTool', role: 'activeTool', path: appendCanvasPath(sessionPath, 'activeToolId'), scope: normalizeStateScope(scopes.activeTool, sessionScope), ephemeral: normalizeStateScope(scopes.activeTool, sessionScope) === 'local' }),
    normalizeCanvasStatePath({ id: 'canvas.session.selection', role: 'selection', path: appendCanvasPath(sessionPath, 'selectedIds'), scope: normalizeStateScope(scopes.selection, sessionScope), ephemeral: normalizeStateScope(scopes.selection, sessionScope) === 'local' }),
    normalizeCanvasStatePath({ id: 'canvas.session.hover', role: 'hover', path: appendCanvasPath(sessionPath, 'hoverId'), scope: normalizeStateScope(scopes.hover, sessionScope), ephemeral: true }),
    normalizeCanvasStatePath({ id: 'canvas.session.pointer', role: 'pointer', path: appendCanvasPath(sessionPath, 'pointer'), scope: normalizeStateScope(scopes.pointer, sessionScope), ephemeral: true }),
    normalizeCanvasStatePath({ id: 'canvas.session.metadata', role: 'sessionMetadata', path: appendCanvasPath(sessionPath, 'metadata'), scope: normalizeStateScope(scopes.sessionMetadata, sessionScope), ephemeral: normalizeStateScope(scopes.sessionMetadata, sessionScope) === 'local' }),
    ...(input.extraPaths ?? []).map((entry) => normalizeCanvasStatePath(entry))
  ].sort((left, right) => left.path.localeCompare(right.path));
  return {
    kind: FRONTIER_CANVAS_STATE_LAYOUT_KIND,
    version: FRONTIER_CANVAS_STATE_LAYOUT_VERSION,
    rootPath,
    documentPath,
    sessionPath,
    paths,
    crdtPaths: paths.filter((entry) => entry.scope === 'crdt').map((entry) => entry.path),
    localPaths: paths.filter((entry) => entry.scope === 'local').map((entry) => entry.path),
    syncablePaths: paths.filter((entry) => entry.syncable).map((entry) => entry.path),
    localOnlyPaths: paths.filter((entry) => entry.localOnly).map((entry) => entry.path),
    ephemeralPaths: paths.filter((entry) => entry.ephemeral).map((entry) => entry.path),
    ...optionalObject('metadata', input.metadata)
  };
}

export function createCanvasStateLayoutForSurface(
  surfaceOrInput: FrontierCanvasSurface | FrontierCanvasSurfaceInput,
  input: Omit<FrontierCanvasStateLayoutInput, 'rootPath' | 'statePath'> = {}
): FrontierCanvasStateLayout {
  const surface = isCanvasSurface(surfaceOrInput) ? surfaceOrInput : createCanvasSurface(surfaceOrInput);
  return createCanvasStateLayout({
    ...input,
    rootPath: surface.statePath
  });
}

export function classifyCanvasStatePath(
  path: FrontierRegistryPath | string,
  layoutOrInput: FrontierCanvasStateLayout | FrontierCanvasStateLayoutInput = {}
): FrontierCanvasStatePath | null {
  const layout = isCanvasStateLayout(layoutOrInput) ? layoutOrInput : createCanvasStateLayout(layoutOrInput);
  const normalized = normalizeFrontierRegistryPath(path);
  let best: FrontierCanvasStatePath | null = null;
  for (const entry of layout.paths) {
    if (!pathContains(entry.path, normalized)) continue;
    if (!best || entry.path.length > best.path.length) best = entry;
  }
  return best;
}

export function partitionCanvasPatches(
  patches: readonly FrontierCanvasPatchInput[],
  layoutOrInput: FrontierCanvasStateLayout | FrontierCanvasStateLayoutInput = {}
): FrontierCanvasPatchPartition {
  const layout = isCanvasStateLayout(layoutOrInput) ? layoutOrInput : createCanvasStateLayout(layoutOrInput);
  const partition: FrontierCanvasPatchPartition = { crdt: [], local: [], unknown: [] };
  for (const patch of patches) {
    const normalized = normalizePatch(patch);
    const classification = classifyCanvasStatePath(normalized.path, layout);
    if (!classification) partition.unknown.push(normalized);
    else if (classification.scope === 'crdt') partition.crdt.push(normalized);
    else partition.local.push(normalized);
  }
  return partition;
}

export function createCanvasToolRegistry<TState = unknown>(
  input: FrontierCanvasToolRegistryInput<TState> = {}
): FrontierCanvasToolRegistry<TState> {
  const tools = new Map<string, FrontierCanvasTool<TState>>();
  const api: FrontierCanvasToolRegistry<TState> = {
    kind: 'frontier.canvas.tool-registry',
    version: 1,
    activeToolId: input.activeToolId,
    get size() {
      return tools.size;
    },
    register(tool) {
      const normalized = isCanvasTool(tool) ? tool : normalizeTool(tool);
      tools.set(normalized.id, normalized);
      if (!api.activeToolId) api.activeToolId = normalized.id;
      return normalized;
    },
    get(id) {
      return tools.get(id);
    },
    list() {
      return Array.from(tools.values()).sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
    },
    dispatch(request) {
      return dispatchCanvasTool(api, request);
    }
  };
  for (const tool of input.tools ?? []) api.register(tool);
  return api;
}

export function dispatchCanvasTool<TState = unknown>(
  registry: FrontierCanvasToolRegistry<TState>,
  request: FrontierCanvasToolDispatchRequest<TState>
): FrontierCanvasToolRecord {
  const createdAt = readNow(request.now);
  const toolId = normalizeId(request.toolId ?? registry.activeToolId ?? request.context.session.activeToolId ?? '', 'canvas tool id');
  const tool = registry.get(toolId);
  if (!tool) {
    return createToolRecord({
      id: 'canvas-tool-record:' + stableHash([toolId, request.event.type, createdAt]),
      toolId,
      eventType: request.event.type,
      status: 'ignored',
      createdAt,
      message: 'unknown canvas tool: ' + toolId,
      metadata: request.metadata
    });
  }
  const handler = tool.handlers.get(request.event.type);
  if (!handler) {
    return createToolRecord({
      id: 'canvas-tool-record:' + stableHash([toolId, request.event.type, createdAt]),
      toolId,
      eventType: request.event.type,
      status: 'ignored',
      createdAt,
      reads: tool.reads,
      writes: tool.writes,
      requires: tool.requires,
      message: 'tool has no handler for event: ' + request.event.type,
      metadata: request.metadata
    });
  }
  try {
    const result = handler(request.context, request.event) ?? {};
    const status = result.status ?? 'ok';
    return createToolRecord({
      id: 'canvas-tool-record:' + stableHash([toolId, request.event.type, status, toolResultSignature(result), createdAt]),
      toolId,
      eventType: request.event.type,
      status,
      createdAt,
      patches: result.patches,
      plans: result.plans,
      reads: tool.reads,
      writes: tool.writes,
      requires: tool.requires,
      message: result.message,
      metadata: result.metadata ?? request.metadata
    });
  } catch (error) {
    return createToolRecord({
      id: 'canvas-tool-record:' + stableHash([toolId, request.event.type, createdAt, 'error']),
      toolId,
      eventType: request.event.type,
      status: 'error',
      createdAt,
      reads: tool.reads,
      writes: tool.writes,
      requires: tool.requires,
      message: error instanceof Error ? error.message : String(error),
      metadata: request.metadata
    });
  }
}

export function createPanCanvasTool<TState = unknown>(
  input: Omit<FrontierCanvasToolInput<TState>, 'id' | 'handlers'> & {
    id?: string;
    cameraPath?: string;
    constraints?: FrontierCanvasCameraConstraintsInput;
    handlers?: Partial<Record<FrontierCanvasToolEventType, FrontierCanvasToolHandler<TState>>>;
  } = {}
): FrontierCanvasTool<TState> {
  const cameraPath = input.cameraPath ?? '/canvas/session/camera';
  return normalizeTool({
    ...input,
    id: input.id ?? 'canvas.pan',
    title: input.title ?? 'Pan canvas',
    cursor: input.cursor ?? 'grab',
    events: uniqueStrings([...(input.events ?? []), 'pointermove']),
    reads: uniquePaths([...(input.reads ?? []), cameraPath]),
    writes: uniquePaths([...(input.writes ?? []), cameraPath]),
    handlers: {
      pointermove(context, event) {
        if (!event.previousScreen || !event.screen) return { status: 'ignored', message: 'pan requires previous and current screen points' };
        const plan = planCanvasPan({
          camera: context.camera,
          viewport: context.viewport,
          deltaScreen: {
            x: event.screen.x - event.previousScreen.x,
            y: event.screen.y - event.previousScreen.y
          },
          cameraPath,
          constraints: input.constraints,
          now: 0
        });
        return { plans: [plan], patches: plan.patches };
      },
      ...(input.handlers ?? {})
    }
  });
}

export function createZoomCanvasTool<TState = unknown>(
  input: Omit<FrontierCanvasToolInput<TState>, 'id' | 'handlers'> & {
    id?: string;
    cameraPath?: string;
    step?: number;
    deltaScale?: number;
    invert?: boolean;
    invertCtrlKey?: boolean;
    constraints?: FrontierCanvasCameraConstraintsInput;
    handlers?: Partial<Record<FrontierCanvasToolEventType, FrontierCanvasToolHandler<TState>>>;
  } = {}
): FrontierCanvasTool<TState> {
  const cameraPath = input.cameraPath ?? '/canvas/session/camera';
  return normalizeTool({
    ...input,
    id: input.id ?? 'canvas.zoom',
    title: input.title ?? 'Zoom canvas',
    cursor: input.cursor ?? 'zoom-in',
    events: uniqueStrings([...(input.events ?? []), 'wheel']),
    reads: uniquePaths([...(input.reads ?? []), cameraPath]),
    writes: uniquePaths([...(input.writes ?? []), cameraPath]),
    handlers: {
      wheel(context, event) {
        if (!event.screen) return { status: 'ignored', message: 'zoom requires a screen point' };
        const plan = planCanvasWheelZoom({
          camera: context.camera,
          viewport: context.viewport,
          event,
          cameraPath,
          step: input.step,
          deltaScale: input.deltaScale,
          invert: input.invert,
          invertCtrlKey: input.invertCtrlKey,
          constraints: input.constraints,
          now: 0
        });
        return { plans: [plan], patches: plan.patches };
      },
      ...(input.handlers ?? {})
    }
  });
}

export function createSelectCanvasTool<TState = unknown>(
  input: Omit<FrontierCanvasToolInput<TState>, 'id' | 'handlers'> & {
    id?: string;
    selectionPath?: string;
    handlers?: Partial<Record<FrontierCanvasToolEventType, FrontierCanvasToolHandler<TState>>>;
  } = {}
): FrontierCanvasTool<TState> {
  const selectionPath = input.selectionPath ?? '/canvas/session/selectedIds';
  return normalizeTool({
    ...input,
    id: input.id ?? 'canvas.select',
    title: input.title ?? 'Select canvas item',
    cursor: input.cursor ?? 'default',
    events: uniqueStrings([...(input.events ?? []), 'pointerdown']),
    writes: uniquePaths([...(input.writes ?? []), selectionPath]),
    handlers: {
      pointerdown(context, event) {
        if (!context.frame || !event.screen) return { status: 'ignored', message: 'select requires a frame and screen point' };
        const hit = hitTestCanvas({ frame: context.frame, point: event.screen, coordinate: 'screen', selectableOnly: true });
        const selectedIds = hit ? [hit.id] : [];
        return {
          selectedIds,
          patches: [{ op: 'set', path: selectionPath, value: selectedIds }]
        };
      },
      ...(input.handlers ?? {})
    }
  });
}

export function createMarqueeSelectCanvasTool<TState = unknown>(
  input: Omit<FrontierCanvasToolInput<TState>, 'id' | 'handlers'> & {
    id?: string;
    selectionPath?: string;
    mode?: FrontierCanvasSelectionMode;
    handlers?: Partial<Record<FrontierCanvasToolEventType, FrontierCanvasToolHandler<TState>>>;
  } = {}
): FrontierCanvasTool<TState> {
  const selectionPath = input.selectionPath ?? '/canvas/session/selectedIds';
  return normalizeTool({
    ...input,
    id: input.id ?? 'canvas.marqueeSelect',
    title: input.title ?? 'Marquee select canvas items',
    cursor: input.cursor ?? 'crosshair',
    events: uniqueStrings([...(input.events ?? []), 'pointerup']),
    writes: uniquePaths([...(input.writes ?? []), selectionPath]),
    handlers: {
      pointerup(context, event) {
        if (!context.frame || !event.startScreen || !event.screen) {
          return { status: 'ignored', message: 'marquee selection requires a frame, start point, and end point' };
        }
        const start = screenToWorld(context.camera, context.viewport, event.startScreen);
        const end = screenToWorld(context.camera, context.viewport, event.screen);
        const selectedIds = selectCanvasItemsInRect({
          frame: context.frame,
          rect: rectFromPoints(start, end),
          mode: input.mode ?? 'intersect',
          selectableOnly: true
        });
        return {
          selectedIds,
          patches: [{ op: 'set', path: selectionPath, value: selectedIds }]
        };
      },
      ...(input.handlers ?? {})
    }
  });
}

export function normalizeCanvasCamera(input: Partial<FrontierCanvasCamera> = {}): FrontierCanvasCamera {
  const minZoom = readFinite(input.minZoom, 0.01);
  const maxZoom = Math.max(minZoom, readFinite(input.maxZoom, 64));
  const zoom = clamp(readFinite(input.zoom, 1), minZoom, maxZoom);
  return {
    x: readFinite(input.x, 0),
    y: readFinite(input.y, 0),
    zoom,
    minZoom,
    maxZoom,
    ...(input.anchorX !== undefined ? { anchorX: readFinite(input.anchorX, 0) } : {}),
    ...(input.anchorY !== undefined ? { anchorY: readFinite(input.anchorY, 0) } : {}),
    ...optionalObject('metadata', input.metadata)
  };
}

export function normalizeCanvasViewport(input: Partial<FrontierCanvasViewport> = {}): FrontierCanvasViewport {
  return {
    width: Math.max(0, readFinite(input.width, 0)),
    height: Math.max(0, readFinite(input.height, 0)),
    dpr: Math.max(0.01, readFinite(input.dpr, 1)),
    left: readFinite(input.left, 0),
    top: readFinite(input.top, 0)
  };
}

export function normalizeCanvasGrid(input: FrontierCanvasGridInput = {}): FrontierCanvasGrid {
  const size = Math.max(0.000001, readFinite(input.size, 1));
  const subdivisions = Math.max(1, Math.floor(readFinite(input.subdivisions, 1)));
  return {
    enabled: input.enabled !== false,
    size,
    subdivisions,
    majorEvery: Math.max(1, Math.floor(readFinite(input.majorEvery, subdivisions))),
    originX: readFinite(input.originX, 0),
    originY: readFinite(input.originY, 0),
    snap: input.snap === true,
    snapX: input.snapX ?? input.snap === true,
    snapY: input.snapY ?? input.snap === true,
    maxLines: Math.max(0, Math.floor(readFinite(input.maxLines, 1000))),
    minScreenStep: Math.max(0, readFinite(input.minScreenStep, 4)),
    ...optionalObject('metadata', input.metadata)
  };
}

export function screenToWorld(
  cameraInput: Partial<FrontierCanvasCamera>,
  viewportInput: Partial<FrontierCanvasViewport>,
  point: FrontierCanvasPoint
): FrontierCanvasPoint {
  const camera = normalizeCanvasCamera(cameraInput);
  const viewport = normalizeCanvasViewport(viewportInput);
  return {
    x: camera.x + (point.x - viewport.left) / camera.zoom,
    y: camera.y + (point.y - viewport.top) / camera.zoom
  };
}

export function worldToScreen(
  cameraInput: Partial<FrontierCanvasCamera>,
  viewportInput: Partial<FrontierCanvasViewport>,
  point: FrontierCanvasPoint
): FrontierCanvasPoint {
  const camera = normalizeCanvasCamera(cameraInput);
  const viewport = normalizeCanvasViewport(viewportInput);
  return {
    x: viewport.left + (point.x - camera.x) * camera.zoom,
    y: viewport.top + (point.y - camera.y) * camera.zoom
  };
}

export function canvasViewportWorldRect(
  cameraInput: Partial<FrontierCanvasCamera>,
  viewportInput: Partial<FrontierCanvasViewport>
): FrontierCanvasRect {
  const camera = normalizeCanvasCamera(cameraInput);
  const viewport = normalizeCanvasViewport(viewportInput);
  return {
    x: camera.x,
    y: camera.y,
    width: viewport.width / camera.zoom,
    height: viewport.height / camera.zoom
  };
}

export function constrainCanvasCamera(
  cameraInput: Partial<FrontierCanvasCamera>,
  viewportInput: Partial<FrontierCanvasViewport>,
  constraintsInput: FrontierCanvasCameraConstraintsInput = {}
): FrontierCanvasCamera {
  const camera = normalizeCanvasCamera({
    ...cameraInput,
    minZoom: constraintsInput.minZoom ?? cameraInput.minZoom,
    maxZoom: constraintsInput.maxZoom ?? cameraInput.maxZoom
  });
  const viewport = normalizeCanvasViewport(viewportInput);
  const zoom = clamp(camera.zoom, camera.minZoom ?? 0.01, camera.maxZoom ?? 64);
  const nextCamera = { ...camera, zoom };
  if (!constraintsInput.bounds || constraintsInput.behavior === 'free' || viewport.width <= 0 || viewport.height <= 0) {
    return nextCamera;
  }
  const bounds = normalizeRect(constraintsInput.bounds);
  const padding = normalizePadding(constraintsInput.padding);
  const left = bounds.x - padding.left / zoom;
  const top = bounds.y - padding.top / zoom;
  const right = bounds.x + bounds.width + padding.right / zoom;
  const bottom = bounds.y + bounds.height + padding.bottom / zoom;
  const viewWidth = viewport.width / zoom;
  const viewHeight = viewport.height / zoom;
  const worldWidth = Math.max(0, right - left);
  const worldHeight = Math.max(0, bottom - top);
  return {
    ...nextCamera,
    x: worldWidth <= viewWidth ? left + (worldWidth - viewWidth) * 0.5 : clamp(nextCamera.x, left, right - viewWidth),
    y: worldHeight <= viewHeight ? top + (worldHeight - viewHeight) * 0.5 : clamp(nextCamera.y, top, bottom - viewHeight)
  };
}

export function canvasWheelZoomFactor(
  event: Pick<FrontierCanvasToolEvent, 'wheelDelta' | 'modifiers'>,
  options: FrontierCanvasWheelZoomOptions = {}
): number {
  const wheel = event.wheelDelta;
  const rawDelta = wheel && wheel.z !== undefined ? readFinite(wheel.z, 0) : -readFinite(wheel?.y, 0);
  const deltaScale = Math.max(1, readFinite(options.deltaScale, 100));
  const step = Math.max(1.000001, readFinite(options.step, 1.2));
  const direction = (options.invert === true || (options.invertCtrlKey === true && event.modifiers?.ctrl === true)) ? -1 : 1;
  return Math.pow(step, direction * rawDelta / deltaScale);
}

export function planCanvasWheelZoom(input: {
  camera: Partial<FrontierCanvasCamera>;
  viewport: Partial<FrontierCanvasViewport>;
  event: FrontierCanvasToolEvent;
  step?: number;
  deltaScale?: number;
  invert?: boolean;
  invertCtrlKey?: boolean;
  minZoom?: number;
  maxZoom?: number;
  constraints?: FrontierCanvasCameraConstraintsInput;
  cameraPath?: FrontierRegistryPath | string;
  now?: number | (() => number);
  metadata?: unknown;
}): FrontierCanvasPlan {
  const screen = input.event.screen ?? { x: 0, y: 0 };
  const factor = canvasWheelZoomFactor(input.event, {
    step: input.step,
    deltaScale: input.deltaScale,
    invert: input.invert,
    invertCtrlKey: input.invertCtrlKey
  });
  return planCanvasZoomAt({
    camera: input.camera,
    viewport: input.viewport,
    screen,
    factor,
    minZoom: input.minZoom,
    maxZoom: input.maxZoom,
    constraints: input.constraints,
    cameraPath: input.cameraPath,
    now: input.now,
    metadata: { ...toJsonObject(input.metadata), wheelFactor: factor }
  });
}

export function planCanvasFitBounds(input: {
  bounds: FrontierCanvasRect;
  viewport: Partial<FrontierCanvasViewport>;
  camera?: Partial<FrontierCanvasCamera>;
  padding?: FrontierCanvasPaddingInput;
  mode?: FrontierCanvasFitMode;
  minZoom?: number;
  maxZoom?: number;
  constraints?: FrontierCanvasCameraConstraintsInput;
  cameraPath?: FrontierRegistryPath | string;
  now?: number | (() => number);
  metadata?: unknown;
}): FrontierCanvasPlan {
  const createdAt = readNow(input.now);
  const previous = normalizeCanvasCamera(input.camera);
  const viewport = normalizeCanvasViewport(input.viewport);
  const bounds = normalizeRect(input.bounds);
  const padding = normalizePadding(input.padding);
  const cameraPath = normalizeFrontierRegistryPath(input.cameraPath ?? '/canvas/session/camera');
  const contentWidth = Math.max(0.000001, viewport.width - padding.left - padding.right);
  const contentHeight = Math.max(0.000001, viewport.height - padding.top - padding.bottom);
  const boundsWidth = Math.max(0.000001, bounds.width);
  const boundsHeight = Math.max(0.000001, bounds.height);
  const fitZoom = input.mode === 'fill'
    ? Math.max(contentWidth / boundsWidth, contentHeight / boundsHeight)
    : Math.min(contentWidth / boundsWidth, contentHeight / boundsHeight);
  const minZoom = input.minZoom ?? previous.minZoom ?? 0.01;
  const maxZoom = Math.max(minZoom, input.maxZoom ?? previous.maxZoom ?? 64);
  const zoom = clamp(fitZoom, minZoom, maxZoom);
  const paddedCenter = {
    x: padding.left + contentWidth * 0.5,
    y: padding.top + contentHeight * 0.5
  };
  const boundsCenter = {
    x: bounds.x + bounds.width * 0.5,
    y: bounds.y + bounds.height * 0.5
  };
  const fittedCamera = {
    ...previous,
    minZoom,
    maxZoom,
    zoom,
    x: boundsCenter.x - paddedCenter.x / zoom,
    y: boundsCenter.y - paddedCenter.y / zoom
  };
  const nextCamera = input.constraints
    ? constrainCanvasCamera(fittedCamera, viewport, { ...input.constraints, minZoom, maxZoom })
    : fittedCamera;
  const patches = cameraPatches(cameraPath, previous, nextCamera);
  return {
    kind: FRONTIER_CANVAS_PLAN_KIND,
    version: FRONTIER_CANVAS_PLAN_VERSION,
    id: 'canvas-plan:' + stableHash(['canvas.fitBounds', previous, viewport, bounds, padding, input.mode ?? 'fit', createdAt]),
    action: 'canvas.fitBounds',
    createdAt,
    patches,
    reads: [cameraPath],
    writes: [cameraPath],
    expectedPatch: patches,
    nextCamera,
    ...optionalObject('metadata', { ...toJsonObject(input.metadata), bounds, padding, mode: input.mode ?? 'fit' })
  };
}

export function planCanvasPan(input: {
  camera: Partial<FrontierCanvasCamera>;
  deltaScreen?: FrontierCanvasPoint;
  deltaWorld?: FrontierCanvasPoint;
  viewport?: Partial<FrontierCanvasViewport>;
  constraints?: FrontierCanvasCameraConstraintsInput;
  cameraPath?: FrontierRegistryPath | string;
  now?: number | (() => number);
  metadata?: unknown;
}): FrontierCanvasPlan {
  const createdAt = readNow(input.now);
  const camera = normalizeCanvasCamera(input.camera);
  const cameraPath = normalizeFrontierRegistryPath(input.cameraPath ?? '/canvas/session/camera');
  const worldDelta = input.deltaWorld
    ? { x: readFinite(input.deltaWorld.x, 0), y: readFinite(input.deltaWorld.y, 0) }
    : {
        x: -readFinite(input.deltaScreen?.x, 0) / camera.zoom,
        y: -readFinite(input.deltaScreen?.y, 0) / camera.zoom
      };
  const pannedCamera = { ...camera, x: camera.x + worldDelta.x, y: camera.y + worldDelta.y };
  const nextCamera = input.constraints && input.viewport
    ? constrainCanvasCamera(pannedCamera, input.viewport, input.constraints)
    : pannedCamera;
  const patches = cameraPatches(cameraPath, camera, nextCamera);
  return {
    kind: FRONTIER_CANVAS_PLAN_KIND,
    version: FRONTIER_CANVAS_PLAN_VERSION,
    id: 'canvas-plan:' + stableHash(['canvas.pan', camera, worldDelta, createdAt]),
    action: 'canvas.pan',
    createdAt,
    patches,
    reads: [cameraPath],
    writes: [cameraPath],
    expectedPatch: patches,
    nextCamera,
    worldDelta,
    ...optionalObject('metadata', input.metadata)
  };
}

export function planCanvasZoomAt(input: {
  camera: Partial<FrontierCanvasCamera>;
  viewport: Partial<FrontierCanvasViewport>;
  screen: FrontierCanvasPoint;
  factor?: number;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  constraints?: FrontierCanvasCameraConstraintsInput;
  cameraPath?: FrontierRegistryPath | string;
  now?: number | (() => number);
  metadata?: unknown;
}): FrontierCanvasPlan {
  const createdAt = readNow(input.now);
  const baseCamera = normalizeCanvasCamera({
    ...input.camera,
    minZoom: input.minZoom ?? input.camera.minZoom,
    maxZoom: input.maxZoom ?? input.camera.maxZoom
  });
  const viewport = normalizeCanvasViewport(input.viewport);
  const cameraPath = normalizeFrontierRegistryPath(input.cameraPath ?? '/canvas/session/camera');
  const worldBefore = screenToWorld(baseCamera, viewport, input.screen);
  const requestedZoom = input.zoom ?? baseCamera.zoom * readFinite(input.factor, 1);
  const zoom = clamp(requestedZoom, baseCamera.minZoom ?? 0.01, baseCamera.maxZoom ?? 64);
  const localScreen = { x: input.screen.x - viewport.left, y: input.screen.y - viewport.top };
  const zoomedCamera = {
    ...baseCamera,
    zoom,
    x: worldBefore.x - localScreen.x / zoom,
    y: worldBefore.y - localScreen.y / zoom
  };
  const nextCamera = input.constraints
    ? constrainCanvasCamera(zoomedCamera, viewport, input.constraints)
    : zoomedCamera;
  const patches = cameraPatches(cameraPath, baseCamera, nextCamera);
  return {
    kind: FRONTIER_CANVAS_PLAN_KIND,
    version: FRONTIER_CANVAS_PLAN_VERSION,
    id: 'canvas-plan:' + stableHash(['canvas.zoomAt', baseCamera, viewport, input.screen, zoom, createdAt]),
    action: 'canvas.zoomAt',
    createdAt,
    patches,
    reads: [cameraPath],
    writes: [cameraPath],
    expectedPatch: patches,
    nextCamera,
    ...optionalObject('metadata', { ...toJsonObject(input.metadata), anchorWorld: worldBefore })
  };
}

export function snapCanvasPoint(point: FrontierCanvasPoint, gridInput: FrontierCanvasGridInput | FrontierCanvasGrid): FrontierCanvasPoint {
  const grid = normalizeCanvasGrid(gridInput);
  return {
    x: grid.snapX ? snapCanvasValue(point.x, grid.size, grid.originX) : point.x,
    y: grid.snapY ? snapCanvasValue(point.y, grid.size, grid.originY) : point.y
  };
}

export function snapCanvasValue(value: number, size = 1, origin = 0): number {
  const step = Math.max(0.000001, readFinite(size, 1));
  return origin + Math.round((readFinite(value, 0) - origin) / step) * step;
}

export function materializeCanvasGrid(
  cameraInput: Partial<FrontierCanvasCamera>,
  viewportInput: Partial<FrontierCanvasViewport>,
  gridInput: FrontierCanvasGridInput | FrontierCanvasGrid = {}
): FrontierCanvasGridMaterialization {
  const camera = normalizeCanvasCamera(cameraInput);
  const viewport = normalizeCanvasViewport(viewportInput);
  const grid = normalizeCanvasGrid(gridInput);
  const worldRect = canvasViewportWorldRect(camera, viewport);
  if (!grid.enabled || viewport.width <= 0 || viewport.height <= 0 || grid.maxLines === 0) {
    return {
      kind: 'frontier.canvas.grid',
      version: 1,
      enabled: false,
      size: grid.size,
      step: grid.size,
      majorEvery: grid.majorEvery,
      worldRect,
      vertical: [],
      horizontal: [],
      skipped: false
    };
  }
  const baseStep = grid.size / grid.subdivisions;
  const minWorldStep = grid.minScreenStep / camera.zoom;
  const multiplier = Math.max(1, Math.ceil(minWorldStep / baseStep));
  const step = baseStep * multiplier;
  const vertical = materializeAxisLines('x', worldRect.x, worldRect.x + worldRect.width, viewport.left, camera.x, camera.zoom, step, grid.originX, grid.majorEvery * grid.size, grid.maxLines);
  const horizontal = materializeAxisLines('y', worldRect.y, worldRect.y + worldRect.height, viewport.top, camera.y, camera.zoom, step, grid.originY, grid.majorEvery * grid.size, grid.maxLines);
  return {
    kind: 'frontier.canvas.grid',
    version: 1,
    enabled: true,
    size: grid.size,
    step,
    majorEvery: grid.majorEvery,
    worldRect,
    vertical: vertical.lines,
    horizontal: horizontal.lines,
    skipped: vertical.skipped || horizontal.skipped
  };
}

export function materializeCanvasFrame(input: FrontierCanvasFrameInput = {}): FrontierCanvasFrame {
  const createdAt = readNow(input.now);
  const surface = input.surface ? (isCanvasSurface(input.surface) ? input.surface : createCanvasSurface(input.surface)) : undefined;
  const document = surface?.document ?? normalizeDocument(input.document ?? { items: input.items, layers: input.layers });
  const session = surface?.session ?? normalizeSession({
    ...input.session,
    camera: input.camera ?? input.session?.camera,
    viewport: input.viewport ?? input.session?.viewport,
    grid: input.grid ?? input.session?.grid,
    selectedIds: input.selectedIds ?? input.session?.selectedIds,
    hoverId: input.hoverId ?? input.session?.hoverId
  });
  const camera = normalizeCanvasCamera(session.camera);
  const viewport = normalizeCanvasViewport(session.viewport);
  const worldRect = canvasViewportWorldRect(camera, viewport);
  const sourceItems = input.spatialAdapter ? input.spatialAdapter.query(worldRect).map(normalizeItem) : document.items;
  const layers = new Map(document.layers.map((layer) => [layer.id, layer]));
  const selected = new Set(session.selectedIds);
  const visibleItems: FrontierCanvasItem[] = [];
  for (const item of sourceItems) {
    if (item.visible && itemIntersects(item, worldRect) && layerAllowsItem(layers, item)) visibleItems.push(item);
  }
  visibleItems.sort((left, right) => left.z - right.z || layerOrder(layers, left.layer) - layerOrder(layers, right.layer) || left.id.localeCompare(right.id));
  const items: FrontierCanvasFrameItem[] = new Array(visibleItems.length);
  for (let index = 0; index < visibleItems.length; index++) {
    items[index] = frameItem(visibleItems[index], camera, viewport, selected, session.hoverId);
  }
  const grid = materializeCanvasGrid(camera, viewport, session.grid);
  const handles = createSelectionHandles(items);
  return {
    kind: FRONTIER_CANVAS_FRAME_KIND,
    version: FRONTIER_CANVAS_FRAME_VERSION,
    id: input.id ?? 'canvas-frame:' + stableHash([surface?.id ?? document.id, camera, viewport, session.selectedIds, createdAt]),
    createdAt,
    camera,
    viewport,
    worldRect,
    grid,
    items,
    selectedIds: session.selectedIds,
    ...(session.hoverId !== undefined ? { hoverId: session.hoverId } : {}),
    handles,
    summary: {
      itemCount: sourceItems.length,
      visibleItemCount: items.length,
      gridLineCount: grid.vertical.length + grid.horizontal.length,
      handleCount: handles.length
    },
    ...optionalObject('metadata', input.metadata)
  };
}

export function hitTestCanvas(input: FrontierCanvasHitTestInput): FrontierCanvasHit | null {
  const tolerance = Math.max(0, readFinite(input.tolerance, 0));
  const coordinate = input.coordinate ?? 'world';
  const sourceItems = input.frame ? input.frame.items : (input.items ?? []).map(normalizeItem);
  let bestItem: FrontierCanvasItem | FrontierCanvasFrameItem | null = null;
  let bestRect: FrontierCanvasRect | null = null;
  let bestDistanceSq = Infinity;
  let bestZ = -Infinity;
  for (const item of sourceItems) {
    const frame = isFrameItem(item) ? item : undefined;
    const rect = coordinate === 'screen' && frame ? frame.screen : item;
    const point = input.point;
    if (input.selectableOnly && item.selectable === false) continue;
    if (!input.includeLocked && item.locked === true) continue;
    if (!pointIntersectsCanvasItem(item, point, coordinate, frame, tolerance)) continue;
    const cx = rect.x + rect.width * 0.5;
    const cy = rect.y + rect.height * 0.5;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const distanceSq = dx * dx + dy * dy;
    const z = item.z ?? 0;
    if (
      !bestItem ||
      z > bestZ ||
      (z === bestZ && (distanceSq < bestDistanceSq || (distanceSq === bestDistanceSq && item.id.localeCompare(bestItem.id) < 0)))
    ) {
      bestItem = item as FrontierCanvasItem | FrontierCanvasFrameItem;
      bestRect = rect;
      bestDistanceSq = distanceSq;
      bestZ = z;
    }
  }
  if (!bestItem || !bestRect) return null;
  return {
    id: bestItem.id,
    item: bestItem,
    distance: Math.sqrt(bestDistanceSq),
    local: { x: input.point.x - bestRect.x, y: input.point.y - bestRect.y }
  };
}

function pointIntersectsCanvasItem(
  item: FrontierCanvasItem | FrontierCanvasFrameItem,
  point: FrontierCanvasPoint,
  coordinate: 'screen' | 'world',
  frame: FrontierCanvasFrameItem | undefined,
  tolerance: number
): boolean {
  const rect = coordinate === 'screen' && frame ? frame.screen : item;
  if (
    point.x < rect.x - tolerance ||
    point.x > rect.x + rect.width + tolerance ||
    point.y < rect.y - tolerance ||
    point.y > rect.y + rect.height + tolerance
  ) return false;
  if (!item.hitArea) return true;
  const worldPoint = coordinate === 'screen' && frame
    ? screenPointToItemWorld(frame, point)
    : point;
  return pointInCanvasHitArea(item, worldPoint, tolerance);
}

function screenPointToItemWorld(item: FrontierCanvasFrameItem, point: FrontierCanvasPoint): FrontierCanvasPoint {
  const scaleX = item.width === 0 ? 1 : item.screen.width / item.width;
  const scaleY = item.height === 0 ? 1 : item.screen.height / item.height;
  return {
    x: item.x + (point.x - item.screen.x) / (scaleX || 1),
    y: item.y + (point.y - item.screen.y) / (scaleY || 1)
  };
}

function pointInCanvasHitArea(
  item: FrontierCanvasItem | FrontierCanvasFrameItem,
  worldPoint: FrontierCanvasPoint,
  extraTolerance: number
): boolean {
  const area = item.hitArea;
  if (!area) return true;
  const localX = worldPoint.x - item.x;
  const localY = worldPoint.y - item.y;
  const tolerance = Math.max(0, area.tolerance + extraTolerance);
  if (area.kind === 'ellipse' || area.kind === 'circle') {
    const rx = Math.max(0.000001, (area.kind === 'circle' ? area.radius ?? area.rx : area.rx) + tolerance);
    const ry = Math.max(0.000001, (area.kind === 'circle' ? area.radius ?? area.ry : area.ry) + tolerance);
    const dx = (localX - area.cx) / rx;
    const dy = (localY - area.cy) / ry;
    return dx * dx + dy * dy <= 1;
  }
  if (area.kind === 'polygon' && area.points.length >= 3) {
    if (tolerance > 0 && !pointInRect({ x: area.x, y: area.y, width: area.width, height: area.height }, { x: localX, y: localY }, tolerance)) {
      return false;
    }
    return pointInPolygon({ x: localX, y: localY }, area.points);
  }
  return pointInRect({ x: area.x, y: area.y, width: area.width, height: area.height }, { x: localX, y: localY }, tolerance);
}

function pointInRect(rect: FrontierCanvasRect, point: FrontierCanvasPoint, tolerance: number): boolean {
  return point.x >= rect.x - tolerance &&
    point.x <= rect.x + rect.width + tolerance &&
    point.y >= rect.y - tolerance &&
    point.y <= rect.y + rect.height + tolerance;
}

function pointInPolygon(point: FrontierCanvasPoint, points: readonly FrontierCanvasPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i];
    const pj = points[j];
    const intersects = ((pi.y > point.y) !== (pj.y > point.y)) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1e-12) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function selectCanvasItemsInRect(input: FrontierCanvasSelectionInRectInput): string[] {
  const rect = normalizeRect(input.rect);
  const sourceItems = input.frame ? input.frame.items : (input.items ?? []).map(normalizeItem);
  const mode = input.mode ?? 'intersect';
  const selectableOnly = input.selectableOnly !== false;
  const layerIds = input.layerIds ? new Set(input.layerIds) : null;
  const tags = input.tags ? uniqueStrings(input.tags) : [];
  const selected: string[] = [];
  for (const item of sourceItems) {
    if (!input.includeInvisible && item.visible === false) continue;
    if (selectableOnly && item.selectable === false) continue;
    if (!input.includeLocked && item.locked === true) continue;
    if (layerIds && (!item.layer || !layerIds.has(item.layer))) continue;
    if (tags.length && !overlaps(item.tags, tags)) continue;
    const matches = mode === 'contain' ? rectContainsItem(rect, item) : rectIntersectsItem(rect, item);
    if (matches) selected.push(item.id);
  }
  return selected.length > 1 ? selected.sort() : selected;
}

export function createCanvasRegistryGraph(
  surfaceOrInput: FrontierCanvasSurface | FrontierCanvasSurfaceInput,
  options: { generatedAt?: number; package?: string; metadata?: JsonObject } = {}
): FrontierRegistryGraph {
  const surface = isCanvasSurface(surfaceOrInput) ? surfaceOrInput : createCanvasSurface(surfaceOrInput);
  const entries: FrontierRegistryEntry[] = [{
    id: 'canvas:' + surface.id,
    kind: 'canvas',
    description: surface.title,
    package: options.package ?? surface.package,
    feature: surface.feature,
    owner: surface.owner,
    source: surface.source,
    reads: [surface.statePath],
    writes: [surface.statePath],
    calls: surface.tools.map((tool) => 'canvas-tool:' + tool.id),
    tags: surface.tags,
    metadata: { summary: toJsonObject(surface.summary) }
  }];
  const edges: FrontierRegistryEdge[] = [];
  for (const layer of surface.document.layers) {
    entries.push({
      id: 'canvas-layer:' + layer.id,
      kind: 'canvas-layer',
      description: layer.title,
      package: options.package ?? surface.package,
      feature: surface.feature,
      owner: surface.owner,
      tags: [],
      metadata: { visible: layer.visible, locked: layer.locked, order: layer.order }
    });
    edges.push({ from: 'canvas:' + surface.id, to: 'canvas-layer:' + layer.id, kind: 'owns' });
  }
  for (const tool of surface.tools) {
    entries.push({
      id: 'canvas-tool:' + tool.id,
      kind: 'action',
      description: tool.description ?? tool.title,
      package: options.package ?? surface.package,
      feature: surface.feature,
      owner: surface.owner,
      reads: tool.reads,
      writes: tool.writes,
      calls: tool.events.map((event) => 'canvas-event:' + event),
      tags: tool.modes,
      metadata: {
        requires: tool.requires,
        controls: tool.controls.map((control) => ({ id: control.id, type: control.type })),
        ...(tool.icon ? { icon: tool.icon } : {}),
        ...(tool.cursor ? { cursor: tool.cursor } : {})
      }
    });
    edges.push({ from: 'canvas:' + surface.id, to: 'canvas-tool:' + tool.id, kind: 'exposes' });
    for (const path of tool.reads) edges.push({ from: 'canvas-tool:' + tool.id, to: path, kind: 'declares-read' });
    for (const path of tool.writes) edges.push({ from: 'canvas-tool:' + tool.id, to: path, kind: 'declares-write' });
  }
  return createFrontierRegistryGraph({ generatedAt: options.generatedAt, entries, edges, metadata: options.metadata });
}

export function traceCanvasImpact(
  surfaceOrInput: FrontierCanvasSurface | FrontierCanvasSurfaceInput,
  input: FrontierRegistryImpactInput = {}
): FrontierRegistryImpact & { surfaceIds: string[]; toolIds: string[]; layerIds: string[]; itemIds: string[] } {
  const surface = isCanvasSurface(surfaceOrInput) ? surfaceOrInput : createCanvasSurface(surfaceOrInput);
  const seedSet = new Set<string>();
  const pathSeeds = new Set<string>();
  const directSeeds = new Set<string>();
  for (const id of input.ids ?? []) {
    seedSet.add(id);
    directSeeds.add(id);
  }
  for (const node of input.nodes ?? []) {
    seedSet.add(node);
    directSeeds.add(node);
    if (typeof node === 'string' && node.startsWith('/')) pathSeeds.add(normalizeFrontierRegistryPath(node));
  }
  for (const path of input.paths ?? []) pathSeeds.add(normalizeFrontierRegistryPath(path));
  for (const path of pathSeeds) seedSet.add(path);
  const pathList = Array.from(pathSeeds);
  const toolIds = surface.tools
    .filter((tool) => {
      if (seedSet.has(tool.id) || seedSet.has('canvas-tool:' + tool.id)) return true;
      if (input.tags && overlaps(tool.modes, input.tags)) return true;
      if (input.features?.includes(surface.feature ?? '')) return true;
      if (input.packages?.includes(surface.package ?? '')) return true;
      return pathList.some((path) => tool.reads.some((read) => pathsOverlap(path, read)) || tool.writes.some((write) => pathsOverlap(path, write)));
    })
    .map((tool) => tool.id);
  const layerIds = surface.document.layers
    .filter((layer) => seedSet.has(layer.id) || seedSet.has('canvas-layer:' + layer.id))
    .map((layer) => layer.id);
  const shouldScanItems = directSeeds.size > 0 || layerIds.length > 0 || !!input.tags?.length;
  const layerSeedSet = layerIds.length ? new Set(layerIds) : null;
  const itemIds = shouldScanItems
    ? surface.document.items
        .filter((item) => directSeeds.has(item.id) || seedSet.has(item.id) || (item.layer && layerSeedSet?.has(item.layer)) || (input.tags && overlaps(item.tags, input.tags)))
        .map((item) => item.id)
    : [];
  const entries: FrontierRegistryEntry[] = [];
  const edges: FrontierRegistryEdge[] = [];
  const surfacePathTouched = Array.from(pathSeeds).some((path) => pathsOverlap(path, surface.statePath));
  if (toolIds.length || layerIds.length || itemIds.length || surfacePathTouched) {
    entries.push({ id: 'canvas:' + surface.id, kind: 'canvas', reads: [surface.statePath], writes: [surface.statePath], tags: surface.tags });
  }
  for (const id of toolIds) {
    const tool = surface.tools.find((candidate) => candidate.id === id);
    if (!tool) continue;
    entries.push({ id: 'canvas-tool:' + id, kind: 'action', reads: tool.reads, writes: tool.writes, tags: tool.modes });
    edges.push({ from: 'canvas:' + surface.id, to: 'canvas-tool:' + id, kind: 'exposes' });
  }
  const nodes = new Set<string>(seedSet);
  for (const entry of entries) nodes.add(entry.id);
  for (const id of layerIds) nodes.add('canvas-layer:' + id);
  for (const id of itemIds) nodes.add('canvas-item:' + id);
  return {
    kind: 'frontier.registry.impact',
    version: 1,
    seeds: Array.from(seedSet),
    nodes: Array.from(nodes),
    entries,
    records: [],
    edges,
    surfaceIds: entries.length ? [surface.id] : [],
    toolIds,
    layerIds,
    itemIds
  };
}

export function encodeCanvasJsonl(values: readonly unknown[]): string {
  return values.map((value) => JSON.stringify(value)).join('\n') + (values.length ? '\n' : '');
}

export function decodeCanvasJsonl(text: string): JsonValue[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length !== 0).map((line) => JSON.parse(line) as JsonValue);
}

export function redactCanvasValue<T extends JsonValue | FrontierCanvasSurface | FrontierCanvasFrame | FrontierCanvasPlan | FrontierCanvasToolRecord>(
  value: T,
  redactions: readonly string[] = ['token', 'secret', 'password', 'authorization', 'cookie', 'credential', 'key']
): T {
  return redactValue(value, redactions) as T;
}

export function createCanvasProof(
  value: FrontierCanvasSurface | FrontierCanvasFrame,
  options: { generatedAt?: number; metadata?: unknown } = {}
): FrontierCanvasProof {
  const generatedAt = options.generatedAt ?? Date.now();
  const surfaceId = isCanvasSurface(value) ? value.id : undefined;
  const redactions = ['token', 'secret', 'password', 'authorization', 'cookie', 'credential', 'key'];
  return {
    kind: FRONTIER_CANVAS_PROOF_KIND,
    version: FRONTIER_CANVAS_PROOF_VERSION,
    ...(surfaceId ? { surfaceId } : {}),
    generatedAt,
    hash: stableHashRedacted(value, redactions),
    summary: isCanvasSurface(value) ? value.summary : value.summary,
    ...optionalObject('metadata', options.metadata)
  };
}

function normalizeDocument(input: FrontierCanvasDocumentInput = {}): FrontierCanvasDocument {
  return {
    id: normalizeId(input.id ?? 'canvas.document', 'canvas document id'),
    ...(input.title ? { title: input.title } : {}),
    items: (input.items ?? []).map(normalizeItem),
    layers: (input.layers ?? []).map(normalizeLayer).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
    ...optionalObject('metadata', input.metadata)
  };
}

function normalizeSession(input: FrontierCanvasSessionInput = {}): FrontierCanvasSession {
  return {
    camera: normalizeCanvasCamera(input.camera),
    viewport: normalizeCanvasViewport(input.viewport),
    grid: normalizeCanvasGrid(input.grid),
    ...(input.activeToolId ? { activeToolId: input.activeToolId } : {}),
    selectedIds: uniqueStrings(input.selectedIds),
    ...(input.hoverId !== undefined ? { hoverId: input.hoverId } : {}),
    ...(input.pointer !== undefined ? { pointer: input.pointer } : {}),
    ...optionalObject('metadata', input.metadata)
  };
}

function normalizeLayer(input: FrontierCanvasLayerInput): FrontierCanvasLayer {
  return {
    id: normalizeId(input.id, 'canvas layer id'),
    ...(input.title ? { title: input.title } : {}),
    visible: input.visible !== false,
    locked: input.locked === true,
    order: Math.floor(readFinite(input.order, 0)),
    ...optionalObject('metadata', input.metadata)
  };
}

function normalizeItem(input: FrontierCanvasItemInput): FrontierCanvasItem {
  return {
    id: normalizeId(input.id, 'canvas item id'),
    x: readFinite(input.x, 0),
    y: readFinite(input.y, 0),
    width: Math.max(0, readFinite(input.width, 0)),
    height: Math.max(0, readFinite(input.height, 0)),
    ...(input.layer ? { layer: input.layer } : {}),
    z: readFinite(input.z, 0),
    visible: input.visible !== false,
    locked: input.locked === true,
    selectable: input.selectable !== false,
    tags: uniqueStrings(input.tags),
    ...(input.hitArea ? { hitArea: normalizeHitArea(input.hitArea, input) } : {}),
    ...optionalJsonValue('value', input.value),
    ...optionalObject('metadata', input.metadata)
  };
}

function normalizeHitArea(input: FrontierCanvasHitAreaInput, item: Pick<FrontierCanvasItemInput, 'width' | 'height'>): FrontierCanvasHitArea {
  const kind = input.kind ?? 'rect';
  const width = Math.max(0, readFinite(input.width, readFinite(item.width, 0)));
  const height = Math.max(0, readFinite(input.height, readFinite(item.height, 0)));
  const x = readFinite(input.x, 0);
  const y = readFinite(input.y, 0);
  const cx = readFinite(input.cx, x + width * 0.5);
  const cy = readFinite(input.cy, y + height * 0.5);
  const radius = input.radius === undefined ? undefined : Math.max(0, readFinite(input.radius, 0));
  const rx = Math.max(0, readFinite(input.rx, radius ?? width * 0.5));
  const ry = Math.max(0, readFinite(input.ry, radius ?? height * 0.5));
  return {
    kind,
    x,
    y,
    width,
    height,
    cx,
    cy,
    rx,
    ry,
    ...(radius !== undefined ? { radius } : {}),
    points: (input.points ?? []).map((point) => ({
      x: readFinite(point.x, 0),
      y: readFinite(point.y, 0)
    })),
    tolerance: Math.max(0, readFinite(input.tolerance, 0)),
    ...optionalObject('metadata', input.metadata)
  };
}

function normalizeTool<TState = unknown>(input: FrontierCanvasToolInput<TState> | FrontierCanvasTool<TState>): FrontierCanvasTool<TState> {
  if (isCanvasTool(input)) return input;
  const handlers = new Map<string, FrontierCanvasToolHandler<TState>>();
  for (const [event, handler] of Object.entries(input.handlers ?? {})) {
    if (handler) handlers.set(event, handler);
  }
  return {
    kind: FRONTIER_CANVAS_TOOL_KIND,
    version: FRONTIER_CANVAS_TOOL_VERSION,
    id: normalizeId(input.id, 'canvas tool id'),
    title: input.title ?? titleFromId(input.id),
    ...(input.description ? { description: input.description } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
    reads: uniqueStrings((input.reads ?? []).map((path) => normalizeFrontierRegistryPath(path))),
    writes: uniqueStrings((input.writes ?? []).map((path) => normalizeFrontierRegistryPath(path))),
    requires: uniqueStrings(input.requires),
    events: uniqueStrings([...(input.events ?? []), ...Object.keys(input.handlers ?? {})]),
    modes: uniqueStrings(input.modes),
    priority: Math.floor(readFinite(input.priority, 0)),
    controls: (input.controls ?? []).map(normalizeToolControl),
    expectedPatch: (input.expectedPatch ?? []).map(normalizePatch),
    ...(input.rollbackToolId ? { rollbackToolId: input.rollbackToolId } : {}),
    ...optionalObject('metadata', input.metadata),
    handlers
  };
}

function normalizeToolControl(input: FrontierCanvasToolControlInput): FrontierCanvasToolControl {
  return {
    type: input.type,
    id: normalizeId(input.id, 'canvas tool control id'),
    ...(input.label ? { label: input.label } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.ariaLabel ? { ariaLabel: input.ariaLabel } : {}),
    ...optionalJsonValue('default', input.default),
    ...(input.min !== undefined ? { min: readFinite(input.min, 0) } : {}),
    ...(input.max !== undefined ? { max: readFinite(input.max, 0) } : {}),
    ...(input.step !== undefined ? { step: readFinite(input.step, 0) } : {}),
    options: (input.options ?? []).map((option) => ({
      value: toJsonValue(option.value),
      ...(option.label ? { label: option.label } : {}),
      ...(option.description ? { description: option.description } : {}),
      ...optionalObject('metadata', option.metadata)
    })),
    ...optionalObject('metadata', input.metadata)
  };
}

function createToolRecord(input: {
  id: string;
  toolId: string;
  eventType: string;
  status: FrontierCanvasToolStatus;
  createdAt: number;
  patches?: readonly FrontierCanvasPatchInput[];
  plans?: readonly FrontierCanvasPlan[];
  reads?: readonly string[];
  writes?: readonly string[];
  requires?: readonly string[];
  message?: string;
  metadata?: unknown;
}): FrontierCanvasToolRecord {
  const inputPatches = input.patches ?? [];
  const patches: FrontierCanvasPatch[] = new Array(inputPatches.length);
  for (let index = 0; index < inputPatches.length; index++) patches[index] = normalizePatch(inputPatches[index]);
  const inputPlans = input.plans ?? [];
  const plans: FrontierCanvasPlan[] = new Array(inputPlans.length);
  for (let index = 0; index < inputPlans.length; index++) plans[index] = clonePlan(inputPlans[index]);
  return {
    kind: FRONTIER_CANVAS_TOOL_RECORD_KIND,
    version: FRONTIER_CANVAS_TOOL_RECORD_VERSION,
    id: input.id,
    toolId: input.toolId,
    eventType: input.eventType,
    status: input.status,
    createdAt: input.createdAt,
    patches,
    plans,
    reads: uniqueStrings(input.reads),
    writes: uniqueStrings(input.writes),
    requires: uniqueStrings(input.requires),
    ...(input.message ? { message: input.message } : {}),
    ...optionalObject('metadata', input.metadata)
  };
}

function toolResultSignature(result: FrontierCanvasToolResult): JsonObject {
  return {
    patchCount: result.patches?.length ?? 0,
    patches: patchListSignature(result.patches ?? []),
    planCount: result.plans?.length ?? 0,
    plans: (result.plans ?? []).map((plan) => ({
      id: plan.id,
      action: plan.action,
      patchCount: plan.patches.length,
      reads: plan.reads.length,
      writes: plan.writes.length
    })),
    selectedCount: result.selectedIds?.length ?? 0,
    ...(result.hoverId !== undefined ? { hoverId: result.hoverId } : {}),
    ...(result.cursor ? { cursor: result.cursor } : {}),
    ...(result.message ? { message: result.message } : {})
  };
}

function patchListSignature(patches: readonly FrontierCanvasPatchInput[]): JsonObject {
  if (patches.length === 0) return { count: 0 };
  return {
    count: patches.length,
    first: patchSignature(patches[0]),
    last: patchSignature(patches[patches.length - 1]),
    hash: hashPatchList(patches)
  };
}

function hashPatchList(patches: readonly FrontierCanvasPatchInput[]): string {
  let hash = 2166136261;
  for (const patch of patches) {
    hash = fnv1a32Update(hash, patch.op ?? 'set');
    hash = fnv1a32Update(hash, String(patch.path));
    hash = fnv1a32Update(hash, valueSignature(patch.value));
    hash = fnv1a32Update(hash, valueSignature(patch.oldValue));
  }
  return formatFnv1a32(hash);
}

function patchSignature(input: FrontierCanvasPatchInput): JsonObject {
  return {
    op: input.op ?? 'set',
    path: normalizeFrontierRegistryPath(input.path),
    value: jsonValueSummary(input.value),
    oldValue: jsonValueSummary(input.oldValue)
  };
}

function valueSignature(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return 'array:' + value.length + ':' + (value.length ? String(primitiveSummary(value[0])) : '') + ':' + (value.length ? String(primitiveSummary(value[value.length - 1])) : '');
  }
  if (typeof value === 'object') return 'object:' + Object.keys(value).length;
  return typeof value + ':' + String(primitiveSummary(value));
}

function jsonValueSummary(value: unknown): JsonObject {
  if (value === undefined) return { type: 'undefined' };
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      first: value.length ? primitiveSummary(value[0]) : null,
      last: value.length ? primitiveSummary(value[value.length - 1]) : null
    };
  }
  if (typeof value === 'object') return { type: 'object', keys: Object.keys(value).length };
  return { type: typeof value, value: primitiveSummary(value) };
}

function primitiveSummary(value: unknown): JsonValue {
  if (value === undefined) return null;
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string') return value as string;
  if (type === 'boolean') return value as boolean;
  if (type === 'number') {
    const number = value as number;
    return Number.isFinite(number) ? number : null;
  }
  return type;
}

function normalizePatch(input: FrontierCanvasPatchInput): FrontierCanvasPatch {
  const patch: FrontierCanvasPatch = {
    op: input.op ?? 'set',
    path: normalizeFrontierRegistryPath(input.path)
  };
  if (input.value !== undefined) patch.value = toJsonValue(input.value);
  if (input.oldValue !== undefined) patch.oldValue = toJsonValue(input.oldValue);
  if (input.metadata !== undefined) patch.metadata = toJsonObject(input.metadata);
  return patch;
}

function cameraPatches(path: string, previous: FrontierCanvasCamera, next: FrontierCanvasCamera): FrontierCanvasPatch[] {
  const patches: FrontierCanvasPatch[] = [];
  if (previous.x !== next.x) patches.push({ op: 'set', path: path + '/x', value: next.x, oldValue: previous.x });
  if (previous.y !== next.y) patches.push({ op: 'set', path: path + '/y', value: next.y, oldValue: previous.y });
  if (previous.zoom !== next.zoom) patches.push({ op: 'set', path: path + '/zoom', value: next.zoom, oldValue: previous.zoom });
  return patches;
}

function materializeAxisLines(
  axis: FrontierCanvasAxis,
  start: number,
  end: number,
  screenOffset: number,
  cameraOffset: number,
  zoom: number,
  step: number,
  origin: number,
  majorStep: number,
  maxLines: number
): { lines: FrontierCanvasGridLine[]; skipped: boolean } {
  const lines: FrontierCanvasGridLine[] = [];
  if (!(step > 0) || end < start) return { lines, skipped: false };
  const firstIndex = Math.floor((start - origin) / step);
  const lastIndex = Math.ceil((end - origin) / step);
  const count = Math.max(0, lastIndex - firstIndex + 1);
  if (count > maxLines) return { lines, skipped: true };
  for (let index = firstIndex; index <= lastIndex; index++) {
    const world = origin + index * step;
    const screen = screenOffset + (world - cameraOffset) * zoom;
    const major = Math.abs((world - origin) / majorStep - Math.round((world - origin) / majorStep)) < 1e-8;
    lines.push({ axis, world, screen, major });
  }
  return { lines, skipped: false };
}

function frameItem(
  item: FrontierCanvasItem,
  camera: FrontierCanvasCamera,
  viewport: FrontierCanvasViewport,
  selected: Set<string>,
  hoverId: string | null | undefined
): FrontierCanvasFrameItem {
  const topLeft = worldToScreen(camera, viewport, item);
  return {
    ...item,
    screen: {
      x: topLeft.x,
      y: topLeft.y,
      width: item.width * camera.zoom,
      height: item.height * camera.zoom
    },
    selected: selected.has(item.id),
    hovered: hoverId === item.id
  };
}

function createSelectionHandles(items: readonly FrontierCanvasFrameItem[]): FrontierCanvasHandle[] {
  const handles: FrontierCanvasHandle[] = [];
  for (const item of items) {
    if (!item.selected) continue;
    const points: Array<[string, number, number, string]> = [
      ['nw', item.x, item.y, 'nwse-resize'],
      ['ne', item.x + item.width, item.y, 'nesw-resize'],
      ['se', item.x + item.width, item.y + item.height, 'nwse-resize'],
      ['sw', item.x, item.y + item.height, 'nesw-resize']
    ];
    for (const [edge, x, y, cursor] of points) {
      const world = { x, y };
      handles.push({
        id: item.id + ':handle:' + edge,
        itemId: item.id,
        kind: 'resize',
        edge,
        world,
        screen: {
          x: edge.includes('e') ? item.screen.x + item.screen.width : item.screen.x,
          y: edge.includes('s') ? item.screen.y + item.screen.height : item.screen.y
        },
        cursor
      });
    }
  }
  return handles;
}

function summarizeCanvas(
  document: FrontierCanvasDocument,
  session: FrontierCanvasSession,
  tools: readonly FrontierCanvasTool[]
): FrontierCanvasSummary {
  return {
    itemCount: document.items.length,
    visibleItemCount: document.items.filter((item) => item.visible).length,
    layerCount: document.layers.length,
    toolCount: tools.length,
    selectedCount: session.selectedIds.length,
    lockedItemCount: document.items.filter((item) => item.locked).length
  };
}

function clonePlan(plan: FrontierCanvasPlan): FrontierCanvasPlan {
  return {
    ...plan,
    patches: plan.patches.map((patch) => ({ ...patch })),
    reads: plan.reads.slice(),
    writes: plan.writes.slice(),
    expectedPatch: plan.expectedPatch.map((patch) => ({ ...patch })),
    ...(plan.nextCamera ? { nextCamera: { ...plan.nextCamera } } : {}),
    ...(plan.worldDelta ? { worldDelta: { ...plan.worldDelta } } : {}),
    ...(plan.metadata ? { metadata: toJsonObject(plan.metadata) } : {})
  };
}

function itemIntersects(item: FrontierCanvasItem, rect: FrontierCanvasRect): boolean {
  return item.x <= rect.x + rect.width &&
    item.x + item.width >= rect.x &&
    item.y <= rect.y + rect.height &&
    item.y + item.height >= rect.y;
}

function layerAllowsItem(layers: ReadonlyMap<string, FrontierCanvasLayer>, item: FrontierCanvasItem): boolean {
  if (!item.layer) return true;
  const layer = layers.get(item.layer);
  return !layer || layer.visible;
}

function layerOrder(layers: ReadonlyMap<string, FrontierCanvasLayer>, layerId: string | undefined): number {
  if (!layerId) return 0;
  return layers.get(layerId)?.order ?? 0;
}

function normalizeCanvasStatePath(input: FrontierCanvasStatePathInput): FrontierCanvasStatePath {
  const scope = normalizeStateScope(input.scope, 'local');
  return {
    id: normalizeId(input.id, 'canvas state path id'),
    path: normalizeFrontierRegistryPath(input.path),
    role: input.role ?? 'custom',
    scope,
    syncable: scope === 'crdt',
    localOnly: scope === 'local',
    ephemeral: input.ephemeral === true,
    ...(input.description ? { description: input.description } : {}),
    ...optionalObject('metadata', input.metadata)
  };
}

function normalizeStateScope(value: unknown, fallback: FrontierCanvasStateScope): FrontierCanvasStateScope {
  return value === 'crdt' || value === 'local' ? value : fallback;
}

function appendCanvasPath(path: string, ...segments: readonly string[]): string {
  let out = normalizeFrontierRegistryPath(path);
  for (const segment of segments) out += '/' + escapePathSegment(segment);
  return out;
}

function escapePathSegment(segment: string): string {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

function pathContains(parent: string, child: string): boolean {
  return parent === child || child.startsWith(parent + '/');
}

function isCanvasStateLayout(value: unknown): value is FrontierCanvasStateLayout {
  return !!value && typeof value === 'object' && (value as FrontierCanvasStateLayout).kind === FRONTIER_CANVAS_STATE_LAYOUT_KIND;
}

function isCanvasSurface(value: unknown): value is FrontierCanvasSurface {
  return !!value && typeof value === 'object' && (value as FrontierCanvasSurface).kind === FRONTIER_CANVAS_SURFACE_KIND;
}

function isCanvasTool<TState = unknown>(value: unknown): value is FrontierCanvasTool<TState> {
  return !!value && typeof value === 'object' && (value as FrontierCanvasTool<TState>).kind === FRONTIER_CANVAS_TOOL_KIND;
}

function isFrameItem(value: FrontierCanvasFrameItem | FrontierCanvasItemInput): value is FrontierCanvasFrameItem {
  return !!value && typeof value === 'object' && 'screen' in value;
}

function normalizeRect(input: FrontierCanvasRect): FrontierCanvasRect {
  const x = readFinite(input.x, 0);
  const y = readFinite(input.y, 0);
  const width = readFinite(input.width, 0);
  const height = readFinite(input.height, 0);
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height)
  };
}

function rectFromPoints(a: FrontierCanvasPoint, b: FrontierCanvasPoint): FrontierCanvasRect {
  return normalizeRect({
    x: a.x,
    y: a.y,
    width: b.x - a.x,
    height: b.y - a.y
  });
}

function rectIntersects(left: FrontierCanvasRect, right: FrontierCanvasRect): boolean {
  return left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y;
}

function rectIntersectsItem(left: FrontierCanvasRect, right: Pick<FrontierCanvasItem, 'x' | 'y' | 'width' | 'height'>): boolean {
  return left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y;
}

function rectContains(left: FrontierCanvasRect, right: FrontierCanvasRect): boolean {
  return right.x >= left.x &&
    right.y >= left.y &&
    right.x + right.width <= left.x + left.width &&
    right.y + right.height <= left.y + left.height;
}

function rectContainsItem(left: FrontierCanvasRect, right: Pick<FrontierCanvasItem, 'x' | 'y' | 'width' | 'height'>): boolean {
  return right.x >= left.x &&
    right.y >= left.y &&
    right.x + right.width <= left.x + left.width &&
    right.y + right.height <= left.y + left.height;
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(right + '/') || right.startsWith(left + '/');
}

function overlaps(left: readonly string[] = [], right: readonly string[] = []): boolean {
  return left.some((value) => right.includes(value));
}

function normalizeId(value: string, label: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) throw new TypeError(label + ' must be a non-empty string');
  return id;
}

function titleFromId(id: string): string {
  const tail = id.split(/[.:/]/).filter(Boolean).pop() ?? id;
  return tail.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueStrings(values: readonly (string | null | undefined)[] = []): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function uniquePaths(values: readonly (FrontierRegistryPath | string | null | undefined)[] = []): string[] {
  return uniqueStrings(values.map((value) => value === null || value === undefined ? undefined : normalizeFrontierRegistryPath(value)));
}

function normalizePadding(input: FrontierCanvasPaddingInput = 0): FrontierCanvasPadding {
  if (typeof input === 'number') {
    const value = Math.max(0, readFinite(input, 0));
    return { top: value, right: value, bottom: value, left: value };
  }
  const x = Math.max(0, readFinite(input.x, 0));
  const y = Math.max(0, readFinite(input.y, 0));
  return {
    top: Math.max(0, readFinite(input.top, y)),
    right: Math.max(0, readFinite(input.right, x)),
    bottom: Math.max(0, readFinite(input.bottom, y)),
    left: Math.max(0, readFinite(input.left, x))
  };
}

function readFinite(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readNow(now: number | (() => number) | undefined): number {
  return typeof now === 'function' ? now() : (Number.isFinite(now) ? Number(now) : Date.now());
}

function optionalObject(key: string, value: unknown): Record<string, JsonObject> {
  if (value === undefined) return {};
  return { [key]: toJsonObject(value) };
}

function optionalJsonValue(key: string, value: unknown): Record<string, JsonValue> {
  if (value === undefined) return {};
  return { [key]: toJsonValue(value) };
}

function toJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return toJsonValue(value) as JsonObject;
}

function toJsonValue(value: unknown): JsonValue {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    const out: JsonValue[] = new Array(value.length);
    for (let index = 0; index < value.length; index++) out[index] = toJsonValue(value[index]);
    return out;
  }
  if (typeof value === 'object') {
    const json = value as { toJSON?: () => unknown };
    if (typeof json.toJSON === 'function') return toJsonValue(json.toJSON());
    const out: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
      out[key] = toJsonValue(child);
    }
    return out;
  }
  return String(value);
}

function redactValue(value: unknown, redactions: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, redactions));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = redactions.some((redaction) => key.toLowerCase().includes(redaction.toLowerCase()))
      ? '[redacted]'
      : redactValue(child, redactions);
  }
  return out;
}

function stableHash(value: unknown): string {
  return formatFnv1a32(stableHashUpdate(2166136261, value));
}

function stableHashRedacted(value: unknown, redactions: readonly string[]): string {
  return formatFnv1a32(stableHashUpdate(2166136261, value, redactions.map((redaction) => redaction.toLowerCase())));
}

function fnv1a32(text: string): string {
  let hash = 2166136261;
  hash = fnv1a32Update(hash, text);
  return formatFnv1a32(hash);
}

function fnv1a32Update(hash: number, text: string): number {
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

function formatFnv1a32(hash: number): string {
  return 'fnv1a32:' + hash.toString(16).padStart(8, '0');
}

function stableHashUpdate(hash: number, value: unknown, redactions: readonly string[] = [], key = ''): number {
  if (key && redactions.length) {
    const lowerKey = key.toLowerCase();
    if (redactions.some((redaction) => lowerKey.includes(redaction))) {
      return fnv1a32Update(hash, JSON.stringify('[redacted]'));
    }
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return fnv1a32Update(hash, 'null');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return fnv1a32Update(hash, JSON.stringify(value));
  if (typeof value === 'number') return fnv1a32Update(hash, Number.isFinite(value) ? JSON.stringify(value) : 'null');
  if (Array.isArray(value)) {
    hash = fnv1a32Update(hash, '[');
    for (let index = 0; index < value.length; index++) {
      if (index > 0) hash = fnv1a32Update(hash, ',');
      hash = stableHashUpdate(hash, value[index], redactions);
    }
    return fnv1a32Update(hash, ']');
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).filter((entry) => {
      const child = object[entry];
      return child !== undefined && typeof child !== 'function' && typeof child !== 'symbol';
    }).sort();
    hash = fnv1a32Update(hash, '{');
    for (let index = 0; index < keys.length; index++) {
      const entry = keys[index];
      if (index > 0) hash = fnv1a32Update(hash, ',');
      hash = fnv1a32Update(hash, JSON.stringify(entry));
      hash = fnv1a32Update(hash, ':');
      hash = stableHashUpdate(hash, object[entry], redactions, entry);
    }
    return fnv1a32Update(hash, '}');
  }
  return fnv1a32Update(hash, JSON.stringify(String(value)));
}

function stableStringifyUnknown(value: unknown, redactions: readonly string[] = [], key = ''): string {
  if (key && redactions.length) {
    const lowerKey = key.toLowerCase();
    if (redactions.some((redaction) => lowerKey.includes(redaction))) {
      return JSON.stringify('[redacted]');
    }
  }
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return 'null';
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (Array.isArray(value)) return '[' + value.map((entry) => stableStringifyUnknown(entry, redactions)).join(',') + ']';
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).filter((entry) => {
      const child = object[entry];
      return child !== undefined && typeof child !== 'function' && typeof child !== 'symbol';
    }).sort();
    return '{' + keys.map((entry) => JSON.stringify(entry) + ':' + stableStringifyUnknown(object[entry], redactions, entry)).join(',') + '}';
  }
  return JSON.stringify(String(value));
}
