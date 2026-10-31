# Decisions

The build notes in `face-recog.txt` called the product Consent Mask. The name in the app, the repo, and the IndexedDB database is **Redact Faces**.

## Tooling

- Bun is the package manager. The script names are still `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `models:fetch`, and `check:dist-size`.
- React 18.3, as specified. TypeScript is pinned to 6 because TypeScript 7 is not supported by typescript-eslint yet.
- Tailwind 4, Zod 4, and react-window 2. react-window 2 is the current package; lists and grids use its `rowComponent` / `cellComponent` API.
- No component library. Dialogs are the native `<dialog>` element. Type is the system UI font. There are no external font requests.

## Capability gate

- A Chromium browser that exposes `showDirectoryPicker` passes the browser check. The failure text still tells people to use Chrome or Edge.
- `adapter.isFallbackAdapter` and `adapter.info.isFallbackAdapter` are both treated as a software adapter.
- Equal to the buffer limits passes. Equal to 1500 ms passes the speed block. Equal to 400 ms does not show the slow warning. “Exceeds” is strict.
- The smoke test uses the Fast pack only. A missing model file is `SESSION_FAILED`, and the error text tells you to run `bun run models:fetch`.
- WebGPU is the only execution provider passed to ONNX Runtime. There is no WASM or CPU fallback.

## Models

- `docs/model-io.md` records the inputs and outputs read from the downloaded files.
- SCRFD outputs are grouped by shape: 12800, 3200, and 800 anchors for strides 8, 16, and 32, with 1, 4, and 10 components. Numeric output names are not used. If a tensor does not match those shapes, the decoder falls back to the order scores, boxes, keypoints.
- If a score tensor contains a value outside 0..1, scores are treated as logits and passed through a sigmoid. The inspected buffalo files are already probabilities, so this leaves them unchanged.
- Both ArcFace files declare output shape `[1, 512]`. Faces are embedded one at a time even though the input batch dimension is symbolic.
- The WebGPU build of ONNX Runtime 1.31 loads `ort-wasm-simd-threaded.asyncify.wasm` (28,747,738 bytes) through `ort.webgpu.min.mjs`, not the bundled build. Vite is aliased to that file so the wasm is not emitted into `dist/`. `scripts/copy-ort.mjs` skips anything over 24 MiB. Local `vite` dev and preview serve `node_modules/onnxruntime-web/dist` at `/ort/`. A production build loads `${VITE_LARGE_MODEL_BASE_URL}/ort/` when `VITE_ORT_WASM_BASE_URL` is empty. Both runtime files have to sit in that prefix, because the `.mjs` resolves the `.wasm` from its own URL.
- `public/_headers` allows the R2 origin on `script-src`, `connect-src`, and `worker-src`. `script-src` is required because ONNX dynamically imports the runtime module. The bucket CORS policy still has to allow the Pages origin.

## Data and export

- Several projects can exist. Each project is one school year.
- Opening a project moves leftover `processing` photos back to `pending`, so a refresh mid-scan can resume.
- The next scan drops photos that are no longer in the folder. A changed size or modified time clears that photo’s faces and scans it again.
- Suggestions are refreshed for `unassigned` and `suggested` faces only. `safe` and `falsePositive` are left alone so “OK to show” is not reversed by a later suggestion.
- A cluster name applies to the selected faces. With nothing selected, it applies to the whole cluster.
- Import stores a backup face whose state was `suggested` as `unassigned`. The backup file does not include the suggested student. Manual regions are restored with no embedding.
- Export stays disabled until every photo is `done`, including `error` and `unsupported`. An unscanned file might still contain someone who cannot be shown. Remove the photo from the project, or replace it and scan again, before exporting. “Export anyway…” is only offered when every photo is done and some faces are still unresolved.
- The output folder is refused when it is the source folder, inside the source folder, or a parent of the source folder. The last case is extra: writing into a parent could still overwrite the originals.
- “Delete all data” deletes the IndexedDB database and reloads. The model cache is separate.

## What the UI claims

Copy stays inside what the software does. It groups similar faces and suggests a name. It does not identify a person by itself. The teacher confirms every name, and consent that is unset is treated as no.
