# Frontier Heightfield Voxel Canvas Demo

Single-player infinite-canvas terrain sketch built on `@shapeshift-labs/frontier-canvas` and `@shapeshift-labs/frontier-canvas-tools`.

The renderer is raw WebGL2. It does not use Three.js.

## Features

- Zelda-like tilted orthographic 3D heightfield rendering with generated vertex/index buffers.
- Authored default terrain vignette with readable grass plateaus, taller warm cliff sides, stone paths, and closer centered camera fitting instead of a noisy radial stress mound.
- Height units are scaled to tile width/depth, so a height of `1` reads as one cube-like tile layer.
- Inkwell-compatible 47-frame blob-rule lookup with coherent shared-edge terrain footprints for `full`, `boxy`, and `rounded` shape modes.
- Separate top treatments: `flat`, `beveled`, and `rounded`, including subtle flat-top edge definition for height breaks.
- Layer-by-layer height adjacency: every occupied height slice gets its own Inkwell mask, while only visible shelves and final tops emit roof/edge geometry.
- Bresenham-connected paint strokes so fast pointer movement does not leave gaps; a pointer gesture commits as one undoable tool transaction.
- Line, filled rectangle, and rectangle-outline tools with ghost previews. Holding command/control during a shape gesture adjusts the committed height before release.
- Direct brush face controls for top, wall, and bevel tile sources. There are no material presets; the brush writes explicit `topSource`, `sideSource`, and `bevelSource` fields.
- Tile atlas built directly from the Inkwell tile PNGs for grass, stone, and clay, with one atlas column for every top/wall/bevel source combination.
- Cell-scale top UVs and edge-distance side UVs so hill tops use the source texture at the correct density while rounded/chamfered cliff segments do not stretch a whole tile across a short edge.
- Per-vertex terrain shade channels inspired by voxel ambient occlusion: top edges, higher-neighbor contact shadows, cliff lips, and side foot shadows are baked into the mesh and quads flip their diagonal to avoid interpolation artifacts.
- Lighting controls for exposure, wall contrast, edge definition, and shadow strength, feeding raw WebGL2 uniforms.
- Depth-tested canvas grid lines disappear behind terrain, and the active brush outline follows height-aware picking instead of persistent square contour overlays.
- Inkwell-style gestures: plain trackpad wheel pans, ctrl/meta/alt wheel pinches zoom at the pointer, and middle/pan-tool drag pans.
- Frontier canvas pan, zoom HUD, grid materialization, undo/redo hotkeys, and state layout.
- Floating tool tray for pan, brush, line, filled rectangle, rectangle outline, eraser, fill, raise, lower, level, and sample tools.
- Rewindable debug panel with full in-memory action history, full patches/inverse patches, mesh, camera, undo/redo depth, state snapshots, and a bounded DOM preview so long scrub sessions stay responsive.
- Tool capabilities, controls, expected patches, and AI action manifest exposure.
- CRDT-ready terrain cell paths with local ephemeral camera/tool/session paths.

## Run

```sh
npm --prefix packages/frontier-canvas/examples/heightfield-voxel-canvas start
```

Then open `http://127.0.0.1:4191`.

## Verify

```sh
npm --prefix packages/frontier-canvas/examples/heightfield-voxel-canvas test
npm --prefix packages/frontier-canvas/examples/heightfield-voxel-canvas run bench -- --rounds 16 --size 40
npm --prefix packages/frontier-canvas/examples/heightfield-voxel-canvas run verify:agent
```

`test` includes the autotile rule fuzzer and checks generated mesh footprints against the bundled Inkwell grey blob mask atlases, shared-edge roof invariants, legacy slope roof ranges, cell-scale top UVs, side-edge UV slices, explicit face-source atlas columns, and height-break shade variation. `verify:agent` uses `@shapeshift-labs/frontier-playwright` probes and AI step evidence against a real Chrome WebGL2 page, including pan gestures, trackpad pan/zoom, direct brush face controls, rectangle tool commits, full-history debug timeline, undo/redo hotkeys, current-state import, unique screenshots, clean scene screenshots, and debug scrub stress. It writes evidence and screenshots under a unique `frontier-heightfield-voxel-agent-runs/<run-id>` directory in the OS temp folder.
