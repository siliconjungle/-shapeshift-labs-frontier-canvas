import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createFrontierAiSession,
  domProbe,
  stateProbe
} from '../../../frontier-playwright/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = readArgs(process.argv.slice(2));
const port = readInt(args.port, 4191);
const url = String(args.url || `http://127.0.0.1:${port}/`);
const runId = String(args.run || `heightfield-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
const defaultRunDir = path.join(os.tmpdir(), 'frontier-heightfield-voxel-agent-runs', runId);
const outPath = path.resolve(String(args.out || path.join(defaultRunDir, 'evidence.json')));
const screenshotPath = path.resolve(String(args.screenshot || path.join(defaultRunDir, 'screenshot.png')));
const sceneScreenshotPath = path.resolve(String(args['scene-screenshot'] || path.join(defaultRunDir, 'scene.png')));
const stateMode = String(args.state || (args['state-file'] ? 'file' : 'current'));
const stateFile = args['state-file'] ? path.resolve(String(args['state-file'])) : '';

async function main() {
  let serverProcess = null;
  let chrome = null;

  try {
  if (!(await urlOk(url))) {
    serverProcess = spawn(process.execPath, [path.join(__dirname, 'server.mjs')], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForUrl(url, 4000);
  }

  const verificationSnapshot = await resolveVerificationSnapshot();

  chrome = await launchChrome();
  const page = await chrome.newPage();
  await page.addInitScript('window.__FRONTIER_HEIGHTFIELD_DISABLE_SERVER_PERSIST__ = true;');
  const frontier = await createFrontierAiSession(page, {
    runId: 'heightfield-voxel-canvas-agent-check',
    sampleLimit: 24,
    defaultMaxDepth: 7,
    defaultMaxEntries: 512,
    state: [
      stateProbe('app', 'window.frontierHeightfieldVoxelCanvas.state', {
        paths: [
          '/ui/activeToolId',
          '/ui/meshSummary/triangleCount',
          '/ui/meshSummary/cellCount',
          '/debug/open',
          '/debug/snapshots',
          '/canvas/session/camera/x',
          '/canvas/session/camera/y',
          '/terrain/settings/shape',
          '/terrain/settings/top',
          '/terrain/settings/topSource',
          '/terrain/settings/sideSource',
          '/terrain/settings/bevelSource',
          '/canvas/session/lighting',
          '/canvas/session/camera/zoom',
          '/actions'
        ]
      }),
      stateProbe('render', renderProbeExpression(), {
        paths: ['/hasWebgl2', '/nonBackground', '/samples', '/statusMesh']
      }),
      stateProbe('tools', 'window.frontierHeightfieldVoxelCanvas.aiManifest', {
        paths: [
          '/actions/0/id', '/actions/1/id', '/actions/2/id', '/actions/3/id',
          '/actions/4/id', '/actions/5/id', '/actions/6/id', '/actions/7/id',
          '/actions/8/id', '/actions/9/id', '/actions/10/id',
          '/summary/actionCount'
        ]
      })
    ],
    dom: [
      domProbe('toolbar-tools', '[data-tool]', {
        include: ['text', 'attributes', 'rect'],
        attributes: ['data-tool', 'class']
      }),
      domProbe('status-panel', '[aria-label="Canvas state"]', {
        include: ['text', 'rect']
      })
    ],
    defaultStep: {
      timeoutMs: 3000,
      intervalMs: 50
    }
  });

  await page.goto(url);
  await waitForPage(page, 'window.frontierHeightfieldVoxelCanvas && window.__FRONTIER_PLAYWRIGHT__');
  if (verificationSnapshot) {
    await page.evaluate((snapshot) => {
      window.frontierHeightfieldVoxelCanvas.importSnapshot(snapshot, { record: false });
    }, verificationSnapshot);
    await waitForPage(page, 'window.frontierHeightfieldVoxelCanvas.state.ui.meshSummary.triangleCount > 0');
  }
  await frontier.sample('loaded');

  const loaded = await page.evaluate(() => {
    const app = window.frontierHeightfieldVoxelCanvas;
    return {
      triangleCount: app?.state?.ui?.meshSummary?.triangleCount ?? 0,
      actionCount: app?.aiManifest?.actions?.length ?? 0,
      statusMesh: document.getElementById('status-mesh')?.textContent ?? ''
    };
  });
  assert(loaded.triangleCount > 0, 'expected visible mesh triangles');
  assert(loaded.actionCount === 13, 'expected thirteen AI-operable canvas and terrain tools');

  await frontier.step('configure lighting and brush face controls', async () => {
    await page.evaluate(() => {
      const setInput = (id, value) => {
        const element = document.getElementById(id);
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const setChange = (id, value) => {
        const element = document.getElementById(id);
        element.value = String(value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setInput('light-exposure', 108);
      setInput('wall-contrast', 22);
      setInput('edge-strength', 48);
      setInput('shadow-strength', 76);
      setChange('prefab-base-top', 'grass');
      setChange('prefab-top', 'stone');
      setChange('prefab-side', 'grass');
      setChange('prefab-bevel', 'clay');
      setChange('prefab-foot', 'stone');
      setChange('texture-shape-mode', 'rounded');
    });
    await waitForPage(page, `
      window.frontierHeightfieldVoxelCanvas.state.canvas.session.lighting.edgeStrength === 48 &&
      window.frontierHeightfieldVoxelCanvas.state.terrain.settings.topSource === 'stone' &&
      window.frontierHeightfieldVoxelCanvas.state.terrain.settings.footSource === 'stone' &&
      window.frontierHeightfieldVoxelCanvas.state.terrain.settings.textureShape === 'rounded' &&
      window.frontierHeightfieldVoxelCanvas.state.terrain.settings.bevelSource === 'clay'
    `);
  });
  const renderConfig = await page.evaluate(() => {
    const app = window.frontierHeightfieldVoxelCanvas;
    return {
      lighting: app.state.canvas.session.lighting,
      settings: app.state.terrain.settings
    };
  });
  assert(renderConfig.lighting.wallContrast === 22, 'wall contrast slider should update render state');
  assert(renderConfig.settings.topSource === 'stone', 'brush faces should update the top tile source');
  assert(renderConfig.settings.sideSource === 'grass', 'brush faces should update the wall tile source');
  assert(renderConfig.settings.bevelSource === 'clay', 'brush faces should update the bevel tile source');

  await frontier.step('paint rectangle through preview tool', async () => {
    await page.evaluate(() => {
      const height = document.getElementById('height-step');
      height.value = '3';
      height.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await clickElementCenter(page, '[data-tool="terrain.rect"]');
    const beforeCount = await page.evaluate(() => window.frontierHeightfieldVoxelCanvas.state.actions.length);
    await page.drag(Math.round(1280 * 0.45), Math.round(800 * 0.46), Math.round(1280 * 0.56), Math.round(800 * 0.56));
    await waitForPage(page, `window.frontierHeightfieldVoxelCanvas.state.actions.length > ${beforeCount}`);
  });
  const rectAction = await page.evaluate(() => {
    const app = window.frontierHeightfieldVoxelCanvas;
    const action = app.state.actions[app.state.actions.length - 1];
    const patch = action?.patches?.find((entry) => entry.value?.height === 3);
    return {
      action: action?.action,
      toolId: action?.record?.toolId,
      height: patch?.value?.height || null,
      patchCount: action?.patches?.length || 0
    };
  });
  assert(rectAction.action === 'terrain.rect.transaction', 'rectangle tool should commit one transaction');
  assert(rectAction.height === 3 && rectAction.patchCount > 1, 'rectangle tool should write the previewed cells');

  let panBefore = null;
  let panAfter = null;
  await frontier.step('pan terrain canvas through pan tool', async () => {
    await clickElementCenter(page, '[data-tool="canvas.pan"]');
    panBefore = await page.evaluate(() => ({ ...window.frontierHeightfieldVoxelCanvas.state.canvas.session.camera }));
    const start = await page.evaluate(() => ({
      x: Math.round(window.innerWidth * 0.54),
      y: Math.round(window.innerHeight * 0.52)
    }));
    await page.drag(start.x, start.y, start.x + 120, start.y + 72);
    panAfter = await page.evaluate(() => ({ ...window.frontierHeightfieldVoxelCanvas.state.canvas.session.camera }));
  }, {
    waitFor: { source: 'state', id: 'app', path: '/actions', changed: true }
  });
  assert(
    Math.abs(panAfter.x - panBefore.x) > 0.01 ||
    Math.abs(panAfter.y - panBefore.y) > 0.01,
    'expected pan tool to move the camera'
  );

  const wheelBefore = await page.evaluate(() => ({ ...window.frontierHeightfieldVoxelCanvas.state.canvas.session.camera }));
  await page.wheel(Math.round(1280 * 0.5), Math.round(800 * 0.5), { deltaX: 96, deltaY: 48 });
  const wheelPanAfter = await page.evaluate(() => ({ ...window.frontierHeightfieldVoxelCanvas.state.canvas.session.camera }));
  assert(wheelPanAfter.zoom === wheelBefore.zoom, 'plain trackpad wheel should pan, not zoom');
  assert(
    Math.abs(wheelPanAfter.x - wheelBefore.x) > 0.01 ||
    Math.abs(wheelPanAfter.y - wheelBefore.y) > 0.01,
    'plain trackpad wheel should move the camera'
  );
  await page.wheel(Math.round(1280 * 0.5), Math.round(800 * 0.5), { deltaY: -96, modifiers: 2 });
  const wheelZoomAfter = await page.evaluate(() => ({ ...window.frontierHeightfieldVoxelCanvas.state.canvas.session.camera }));
  assert(wheelZoomAfter.zoom > wheelPanAfter.zoom, 'ctrl/meta trackpad wheel should zoom at the pointer');

  await frontier.step('open rewind debug panel', async () => {
    await clickElementCenter(page, '#debug-toggle');
  }, {
    waitFor: { source: 'state', id: 'app', path: '/debug/open', changed: true }
  });
  const debugOpen = await page.evaluate(() => ({
    open: window.frontierHeightfieldVoxelCanvas.state.debug.open,
    panelOpen: document.getElementById('debug-panel')?.classList.contains('open') ?? false,
    snapshots: window.frontierHeightfieldVoxelCanvas.state.debug.snapshots.length
  }));
  assert(debugOpen.open && debugOpen.panelOpen && debugOpen.snapshots > 0, 'expected rewind debug panel to open with snapshots');

  const paintStep = await frontier.step('edit terrain through frontier tool', async () => {
    const beforeCount = await page.evaluate(() => window.frontierHeightfieldVoxelCanvas.state.actions.length);
    await page.evaluate(() => {
      window.frontierHeightfieldVoxelCanvas.applyTerrainCellEdit(2, 2, {
        height: 4,
        topSource: 'stone',
        sideSource: 'stone',
        bevelSource: 'stone',
        shape: 'rounded',
        top: 'beveled'
      }, 'agent.terrainCellEdit');
    });
    await waitForPage(page, `window.frontierHeightfieldVoxelCanvas.state.actions.length > ${beforeCount}`);
  });

  const beforeUndo = await page.evaluate(() => {
    const app = window.frontierHeightfieldVoxelCanvas;
    const action = app.state.actions[app.state.actions.length - 1];
    const patch = action?.patches?.find((entry) => entry.path?.startsWith('/terrain/cells/'));
    const key = patch?.path?.split('/').pop();
    return {
      action: action?.action,
      key,
      value: key ? app.state.terrain.cells[key] : null
    };
  });
  assert(beforeUndo.key, 'expected paint action to write a terrain cell');
  await page.keyCombo({ key: 'z', code: 'KeyZ', modifiers: 4 });
  const afterUndo = await page.evaluate((key) => {
    const app = window.frontierHeightfieldVoxelCanvas;
    return {
      action: app.state.actions[app.state.actions.length - 1]?.action,
      value: app.state.terrain.cells[key] || null,
      undoDepth: app.state.history.undoStack.length,
      redoDepth: app.state.history.redoStack.length
    };
  }, beforeUndo.key);
  assert(afterUndo.action === 'history.undo', 'expected meta-z to record history.undo');
  assert(JSON.stringify(afterUndo.value) !== JSON.stringify(beforeUndo.value), 'undo hotkey should restore the previous terrain cell');
  assert(afterUndo.redoDepth > 0, 'undo should populate redo stack');
  await page.keyCombo({ key: 'z', code: 'KeyZ', modifiers: 12 });
  const afterRedo = await page.evaluate((key) => {
    const app = window.frontierHeightfieldVoxelCanvas;
    return {
      action: app.state.actions[app.state.actions.length - 1]?.action,
      value: app.state.terrain.cells[key] || null
    };
  }, beforeUndo.key);
  assert(afterRedo.action === 'history.redo', 'expected meta-shift-z to record history.redo');
  assert(JSON.stringify(afterRedo.value) === JSON.stringify(beforeUndo.value), 'redo hotkey should reapply the terrain cell');

  await frontier.step('paint stroke records one undo transaction', async () => {
    await page.evaluate(() => {
      const app = window.frontierHeightfieldVoxelCanvas;
      app.state.debug.open = false;
      app.state.debug.previewMode = false;
      app.state.terrain.settings = {
        heightStep: 13,
        brushSize: 1,
        shape: 'rounded',
        top: 'rounded',
        topSource: 'clay',
        sideSource: 'clay',
        bevelSource: 'clay',
        fillContiguous: true
      };
      document.getElementById('debug-panel')?.classList.remove('open');
      document.getElementById('debug-toggle')?.classList.remove('active');
    });
    await clickElementCenter(page, '[data-tool="terrain.brush"]');
    const beforeCount = await page.evaluate(() => window.frontierHeightfieldVoxelCanvas.state.actions.length);
    const points = await page.evaluate(() => ({
      x0: Math.round(window.innerWidth * 0.36),
      y0: Math.round(window.innerHeight * 0.56),
      x1: Math.round(window.innerWidth * 0.66),
      y1: Math.round(window.innerHeight * 0.56)
    }));
    await page.drag(points.x0, points.y0, points.x1, points.y1);
    await waitForPage(page, `window.frontierHeightfieldVoxelCanvas.state.actions.length > ${beforeCount}`);
  });
  const strokeTransaction = await page.evaluate(() => {
    const app = window.frontierHeightfieldVoxelCanvas;
    const action = app.state.actions[app.state.actions.length - 1];
    return {
      action: action?.action,
      patchCount: action?.patches?.length || 0,
      inversePatchCount: action?.inversePatches?.length || 0,
      undoDepth: app.state.history.undoStack.length,
      paths: (action?.patches || []).map((patch) => patch.path)
    };
  });
  assert(
    strokeTransaction.action === 'terrain.brush.transaction',
    `expected one terrain brush transaction action, got ${strokeTransaction.action}`
  );
  assert(strokeTransaction.patchCount > 1, 'expected one brush stroke transaction to contain multiple cell patches');
  assert(
    strokeTransaction.inversePatchCount === strokeTransaction.patchCount,
    'transaction inverse patches should cover every stroke patch'
  );

  await page.keyCombo({ key: 'z', code: 'KeyZ', modifiers: 4 });
  const strokeUndo = await page.evaluate((paths) => {
    const app = window.frontierHeightfieldVoxelCanvas;
    const action = app.state.actions[app.state.actions.length - 1];
    return {
      action: action?.action,
      redoDepth: app.state.history.redoStack.length,
      values: paths.map((patchPath) => {
        const key = String(patchPath).split('/').pop();
        return app.state.terrain.cells[key] || null;
      })
    };
  }, strokeTransaction.paths);
  assert(strokeUndo.action === 'history.undo', 'expected undo after a stroke to record history.undo');
  assert(strokeUndo.redoDepth > 0, 'stroke undo should populate redo stack');
  assert(
    strokeUndo.values.every((value) => !value || value.height !== 13),
    'stroke undo should revert the whole painted transaction, not one sampled move'
  );

  await frontier.sample('after-paint');
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.rm(screenshotPath, { force: true }).catch(() => {});
  const screenshotStartedAt = Date.now();
  await page.screenshot(screenshotPath);
  const screenshotStat = await fs.stat(screenshotPath);
  assert(screenshotStat.size > 0 && screenshotStat.mtimeMs >= screenshotStartedAt - 1000, 'expected a fresh screenshot for this verifier run');
  await fs.rm(sceneScreenshotPath, { force: true }).catch(() => {});
  await page.evaluate(() => {
    const app = window.frontierHeightfieldVoxelCanvas;
    if (app?.state?.debug) app.state.debug.open = false;
    document.getElementById('debug-panel')?.classList.remove('open');
    document.getElementById('debug-toggle')?.classList.remove('active');
    const setInput = (id, value) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.value = String(value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const setChange = (id, value) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.value = String(value);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setInput('light-exposure', 106);
    setInput('wall-contrast', 16);
    setInput('edge-strength', 42);
    setInput('shadow-strength', 84);
    setChange('prefab-top', 'grass');
    setChange('prefab-side', 'clay');
    setChange('prefab-bevel', 'grass');
    document.getElementById('reset-terrain')?.click();
    document.getElementById('reset-camera')?.click();
  });
  await waitForPage(page, 'window.frontierHeightfieldVoxelCanvas.state.terrain.settings.topSource === "grass"');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const sceneScreenshotStartedAt = Date.now();
  await page.screenshot(sceneScreenshotPath);
  const sceneScreenshotStat = await fs.stat(sceneScreenshotPath);
  assert(
    sceneScreenshotStat.size > 0 && sceneScreenshotStat.mtimeMs >= sceneScreenshotStartedAt - 1000,
    'expected a fresh clean scene screenshot for this verifier run'
  );

  const evidence = await frontier.evidence([
    { id: 'mesh-built', query: { source: 'state', id: 'app', path: '/ui/meshSummary/triangleCount' }, limit: 3 },
    { id: 'webgl-rendered', query: { source: 'state', id: 'render', path: '/nonBackground' }, limit: 3 },
    { id: 'ai-tools', query: { source: 'state', id: 'tools', path: '/summary/actionCount' }, limit: 3 },
    { id: 'paint-action', query: { source: 'state', id: 'app', path: '/actions', changed: true }, limit: 4 },
    { id: 'toolbar-dom', query: { source: 'dom', id: 'toolbar-tools', textIncludes: '↑' }, limit: 2 },
    { id: 'status-dom', query: { source: 'dom', id: 'status-panel', textIncludes: 'Mesh' }, limit: 2 }
  ], {
    includeJsonl: true,
    includeLogRecords: true,
    includeTimeline: true
  });

  const renderMatches = evidence.report.queries.find((query) => query.id === 'webgl-rendered')?.matches ?? [];
  const latestRender = renderMatches[renderMatches.length - 1]?.value;
  assert(typeof latestRender === 'number' && latestRender > 0, 'expected non-background WebGL pixels');

  const scrubStress = await page.evaluate(async () => {
    const app = window.frontierHeightfieldVoxelCanvas;
    for (let i = 0; i < 120; i += 1) {
      app.applyTerrainCellEdit(80 + (i % 20), 80 + Math.floor(i / 20), {
        height: 1 + (i % 4),
        topSource: ['grass', 'stone', 'clay'][i % 3],
        sideSource: ['clay', 'stone', 'grass'][i % 3],
        bevelSource: ['grass', 'stone', 'clay'][(i + 1) % 3],
        shape: i % 2 ? 'rounded' : 'boxy',
        top: i % 3 ? 'beveled' : 'rounded'
      }, 'agent.debugScrubStress');
    }
    app.state.debug.open = true;
    document.getElementById('debug-panel')?.classList.add('open');
    document.getElementById('debug-toggle')?.classList.add('active');
    const timeline = document.getElementById('debug-timeline');
    const max = Number(timeline?.max || app.state.debug.snapshots.length - 1);
    const started = performance.now();
    for (let i = 0; i < 96; i += 1) {
      timeline.value = String(Math.round((max * i) / 95));
      timeline.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      durationMs: Math.round((performance.now() - started) * 1000) / 1000,
      actionCount: app.state.actions.length,
      snapshotCount: app.state.debug.snapshots.length,
      historyTextLength: document.getElementById('debug-history')?.textContent?.length || 0,
      patchTextLength: document.getElementById('debug-patches')?.textContent?.length || 0
    };
  });
  assert(scrubStress.durationMs < 1500, `debug timeline scrub was too slow: ${scrubStress.durationMs}ms`);
  assert(scrubStress.historyTextLength < 45000, 'debug history panel should render a bounded window, not the full action log');

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({
    runId,
    loaded,
    paintStep,
    evidence,
    scrubStress,
    screenshotPath,
    sceneScreenshotPath,
    stateMode,
    stateSource: verificationSnapshot ? (stateFile || 'server-current-state') : 'default-demo-state'
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    runId,
    url,
    evidencePath: outPath,
    screenshotPath,
    sceneScreenshotPath,
    stateSource: verificationSnapshot ? (stateFile || 'server-current-state') : 'default-demo-state',
    loaded,
    step: {
      id: paintStep.id,
      label: paintStep.label,
      beforeIndex: paintStep.beforeIndex,
      afterIndex: paintStep.afterIndex,
      waitMatches: Object.keys(paintStep.matches).length
    },
    scrubStress,
    summary: evidence.report.summary
  }, null, 2));
  } finally {
    if (chrome) await chrome.close().catch(() => {});
    if (serverProcess) serverProcess.kill('SIGTERM');
  }
}

async function clickElementCenter(page, selector) {
  const point = await page.evaluate((nextSelector) => {
    const element = document.querySelector(nextSelector);
    if (!element) throw new Error(`missing element: ${nextSelector}`);
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width * 0.5),
      y: Math.round(rect.top + rect.height * 0.5)
    };
  }, selector);
  await page.click(point.x, point.y);
}

async function resolveVerificationSnapshot() {
  if (stateMode === 'default' || stateMode === 'none') return null;
  if (stateFile) {
    const parsed = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    return parsed.state || parsed;
  }
  if (stateMode !== 'current' && stateMode !== 'server') return null;
  try {
    const endpoint = new URL('/__frontier/heightfield-state', url);
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const parsed = await response.json();
    return parsed.state || parsed;
  } catch {
    return null;
  }
}

function renderProbeExpression() {
  return `(() => {
    const canvas = document.getElementById('scene');
    const gl = canvas && canvas.getContext('webgl2');
    if (!gl) return { hasWebgl2: false, nonBackground: 0, samples: 0, statusMesh: 'missing' };
    const pixel = new Uint8Array(4);
    const bg = [11, 15, 18];
    let nonBackground = 0;
    let samples = 0;
    const stepX = Math.max(1, Math.floor(canvas.width / 16));
    const stepY = Math.max(1, Math.floor(canvas.height / 12));
    for (let y = 40; y < canvas.height - 40; y += stepY) {
      for (let x = 40; x < canvas.width - 40; x += stepX) {
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        samples += 1;
        const delta = Math.abs(pixel[0] - bg[0]) + Math.abs(pixel[1] - bg[1]) + Math.abs(pixel[2] - bg[2]);
        if (delta > 18) nonBackground += 1;
      }
    }
    return {
      hasWebgl2: true,
      nonBackground,
      samples,
      statusMesh: document.getElementById('status-mesh')?.textContent ?? ''
    };
  })()`;
}

class CdpBrowser {
  constructor(process, port, profileDir) {
    this.process = process;
    this.port = port;
    this.profileDir = profileDir;
  }

  static async launch() {
    const chromePath = findChrome();
    const port = await freePort();
    const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frontier-heightfield-agent-chrome-'));
    const chromeArgs = [
      '--headless=new',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${port}`,
      '--window-size=1280,800',
      '--enable-webgl',
      'about:blank'
    ];
    if (process.platform === 'darwin') chromeArgs.splice(chromeArgs.length - 1, 0, '--use-angle=metal');
    const child = spawn(chromePath, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    await waitForCdp(port, child);
    return new CdpBrowser(child, port, profileDir);
  }

  async newPage() {
    const target = await cdpHttp(this.port, '/json/new?about:blank', { method: 'PUT' });
    const page = await CdpPage.connect(target.webSocketDebuggerUrl);
    await page.enable();
    return page;
  }

  async close() {
    this.process.kill('SIGTERM');
    await fs.rm(this.profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

class CdpPage {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
    this.events = [];
    ws.addEventListener('message', (event) => this.onMessage(event));
  }

  static async connect(wsUrl) {
    if (typeof WebSocket !== 'function') throw new Error('Node WebSocket global is required for CDP verification');
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new CdpPage(ws);
  }

  async enable() {
    await this.send('Runtime.enable');
    await this.send('Page.enable');
    await this.send('Log.enable');
  }

  async addInitScript(script) {
    const source = typeof script === 'string' ? script : script.content;
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async evaluate(pageFunction, arg) {
    const expression = typeof pageFunction === 'string'
      ? pageFunction
      : `(${pageFunction.toString()})(${arg === undefined ? 'undefined' : JSON.stringify(arg)})`;
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed';
      throw new Error(description);
    }
    return result.result?.value;
  }

  async goto(nextUrl) {
    const loaded = this.waitForEvent('Page.loadEventFired', 5000);
    await this.send('Page.navigate', { url: nextUrl });
    await loaded.catch(() => {});
    await waitForPage(this, 'document.readyState === "complete"', 5000);
  }

  async click(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', pointerType: 'mouse' });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
  }

  async drag(x0, y0, x1, y1) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, button: 'none', pointerType: 'mouse' });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(x0 + (x1 - x0) * t),
        y: Math.round(y0 + (y1 - y0) * t),
        button: 'left',
        buttons: 1,
        pointerType: 'mouse'
      });
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
  }

  async wheel(x, y, options = {}) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x,
      y,
      deltaX: Number(options.deltaX) || 0,
      deltaY: Number(options.deltaY) || 0,
      modifiers: Number(options.modifiers) || 0,
      pointerType: 'mouse'
    });
  }

  async keyCombo({ key, code, modifiers = 0 }) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      text: modifiers ? '' : key,
      unmodifiedText: key,
      windowsVirtualKeyCode: String(key).toUpperCase().charCodeAt(0),
      nativeVirtualKeyCode: String(key).toUpperCase().charCodeAt(0),
      modifiers
    });
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: String(key).toUpperCase().charCodeAt(0),
      nativeVirtualKeyCode: String(key).toUpperCase().charCodeAt(0),
      modifiers
    });
  }

  async screenshot(file) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await fs.writeFile(file, Buffer.from(result.data, 'base64'));
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
    });
  }

  waitForEvent(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('timed out waiting for ' + method));
      }, timeoutMs);
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push((payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
      this.eventWaiters.set(method, waiters);
    });
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const request = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result || {});
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') this.events.push(message.params.exceptionDetails);
    if (message.method === 'Log.entryAdded') this.events.push(message.params.entry);
    const waiters = this.eventWaiters.get(message.method);
    if (waiters?.length) {
      this.eventWaiters.delete(message.method);
      for (const waiter of waiters) waiter(message.params);
    }
  }

  async close() {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }
}

async function launchChrome() {
  return CdpBrowser.launch();
}

async function waitForPage(page, expression, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await page.evaluate(`Boolean(${expression})`).catch(() => false);
    if (ok) return;
    await sleep(50);
  }
  throw new Error('timed out waiting for page expression: ' + expression);
}

async function waitForCdp(port, child) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    if (child.exitCode !== null) throw new Error('Chrome exited before CDP was ready');
    try {
      await cdpHttp(port, '/json/version');
      return;
    } catch {
      await sleep(80);
    }
  }
  throw new Error('timed out waiting for Chrome CDP');
}

async function cdpHttp(port, pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  if (!response.ok) throw new Error(`CDP HTTP ${response.status} for ${pathname}`);
  return response.json();
}

async function waitForUrl(nextUrl, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await urlOk(nextUrl)) return;
    await sleep(80);
  }
  throw new Error('timed out waiting for ' + nextUrl);
}

function urlOk(nextUrl) {
  return new Promise((resolve) => {
    const request = http.get(nextUrl, (response) => {
      response.resume();
      resolve((response.statusCode || 500) < 500);
    });
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const nextPort = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(nextPort));
    });
    server.on('error', reject);
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    commandPath('google-chrome'),
    commandPath('chromium'),
    commandPath('chromium-browser')
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to run the agent verification.');
}

function commandPath(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
