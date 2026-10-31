# Redact Faces

Black out the faces of those who don’t have photo permission. Runs in the browser; photos never leave the computer. Groups similar faces so you name each person once.

A teacher points the app at a folder of class photos. It finds faces, groups people who look alike, and waits for a name and a consent choice. Export downloads a zip of new JPEGs with solid black rectangles over anyone who has not been marked “yes.” The originals are never modified.

This tool only assists. The teacher is responsible for checking every photo before sharing it.

Face detection and embedding use InsightFace pretrained weights (`buffalo_sc` and, optionally, `buffalo_l`). Those weights are licensed for **non-commercial research use only**. Redact Faces stays free. Do not sell it or ship it as part of a paid product.

## Local development

Install [Bun](https://bun.sh), then:

```bash
bun install
bun run dev
```

Open the printed localhost URL in Chrome or Edge. `bun run dev` serves the WebGPU runtime from `node_modules` because that file is too large to deploy (see below).

Check the project with:

```bash
bun run typecheck
bun run lint
bun run test
```

## Models

```bash
bun run models:fetch
```

That downloads the official InsightFace v0.7 release zips, keeps the four ONNX files, and rewrites `src/engine/models.manifest.json` plus `docs/model-io.md`.

| Pack     | Files                             | Where                                      |
| -------- | --------------------------------- | ------------------------------------------ |
| Fast     | `det_500m.onnx`, `w600k_mbf.onnx` | `public/models/` (deployed with the site)  |
| Accurate | `det_10g.onnx`, `w600k_r50.onnx`  | `models-large/` (gitignored, upload to R2) |

If a download fails, the app still builds and shows a model-files-missing message on the gate screen. Run the command above on a machine with network access.

The Accurate option is hidden until `VITE_LARGE_MODEL_BASE_URL` is set to the public base URL of those two files, with no trailing slash. See `.env.example`.

## Cloudflare Pages

- Build command: `bun run build`
- Output directory: `dist`
- Node version: 22 (Bun is installed in the build image, or run the install step with Bun)

`bun run build` runs the typecheck, the Vite build, and `check:dist-size`. The size check fails if any file in `dist/` is over 24 MiB. Cloudflare Pages rejects files over 25 MiB.

### R2

Create a bucket and allow the Pages origin to `GET` the model files:

```json
[
  {
    "AllowedOrigins": ["https://your-project.pages.dev"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

Upload `models-large/` for the Accurate pack. Set `VITE_LARGE_MODEL_BASE_URL` at **build** time to that public URL.

The ONNX Runtime WebGPU file `ort-wasm-simd-threaded.asyncify.wasm` is 28,747,738 bytes, so it is not copied into `dist/`. A production build loads it from `${VITE_LARGE_MODEL_BASE_URL}/ort/` unless `VITE_ORT_WASM_BASE_URL` is set. Upload `ort-wasm-simd-threaded.asyncify.wasm` and `ort-wasm-simd-threaded.asyncify.mjs` from `node_modules/onnxruntime-web/dist/` to that `ort/` prefix. Local `bun run dev` still serves `/ort/` from `node_modules`.

`public/_headers` allows the configured R2 origin in `script-src`, `connect-src`, and `worker-src`. The `.mjs` is loaded with `import()`, so `connect-src` alone is not enough. The bucket also needs CORS that allows `GET` from the Pages origin.

## Privacy

Photos, thumbnails, face crops, names, and consent stay in this browser (IndexedDB and the folder you pick). The site does not have accounts, analytics, or a backend. The only network requests are the site’s own files and, if you choose it, the Accurate model or the hosted WebGPU runtime.

“Delete all data” removes the IndexedDB database and folder access, then reloads. It does not delete the model cache. Settings has a separate “Clear model cache” button.

## Known limits

- Children’s faces are harder to match than adult faces. Expect many faces to stay unassigned until you name them. Thresholds start untuned; the calibration view in Settings appears after two students each have three confirmed faces.
- HEIC is not decoded. Convert those photos to JPEG first. Unsupported and failed photos block export until you remove them from the project or replace them and scan again, because a photo that was never scanned might still contain someone who cannot be shown.
- Chromium only (Chrome or Edge). Other browsers get an explanation and cannot continue.
- Stills only. There is no video, no accounts, and no phone layout.
