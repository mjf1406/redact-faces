import type { GateCode } from './evaluate';

export const GATE_COPY: Record<
  GateCode,
  { headline: string; explanation: string; steps: string[] }
> = {
  INSECURE_CONTEXT: {
    headline: 'This page is not a secure context',
    explanation:
      'Redact Faces reads photo folders on your computer. Browsers only allow that on HTTPS, or on localhost.',
    steps: [
      'Open the site with https://, or use http://localhost while developing.',
      'Do not open the built files directly from a folder.',
    ],
  },
  UNSUPPORTED_BROWSER: {
    headline: 'This browser cannot open photo folders',
    explanation:
      'Choosing a folder of photos needs a Chromium browser. Firefox and Safari do not provide the file-system API this app uses.',
    steps: [
      'Install the current Google Chrome or Microsoft Edge.',
      'Open this site in that browser.',
    ],
  },
  NO_WEBGPU: {
    headline: 'WebGPU is turned off',
    explanation:
      'Face detection runs on your graphics card through WebGPU. This browser does not expose it, so the app stops rather than silently using the CPU.',
    steps: [
      'Update Chrome or Edge.',
      'In Chrome settings, search for “Use graphics acceleration when available” and turn it on, then relaunch.',
    ],
  },
  NO_ADAPTER: {
    headline: 'No graphics adapter is available',
    explanation:
      'The browser could not get a high-performance GPU adapter. Photos would not be scanned reliably, so the app stays closed.',
    steps: [
      'Update your GPU driver and relaunch the browser.',
      'Open chrome://gpu and check that WebGPU is hardware accelerated.',
    ],
  },
  SOFTWARE_ADAPTER: {
    headline: 'The browser is using a software GPU',
    explanation:
      'Chrome fell back to a software adapter. No real graphics card is doing the work, and scanning a class set of photos would be too slow and unreliable.',
    steps: [
      'Turn graphics acceleration back on and relaunch Chrome or Edge.',
      'On a remote desktop, use a machine with a real GPU.',
    ],
  },
  LIMITS_TOO_LOW: {
    headline: 'This GPU cannot hold the face models',
    explanation:
      'The models need a storage buffer of at least 128 MiB and a max buffer of at least 256 MiB. This adapter reports less than that.',
    steps: ['Try the current Chrome or Edge on a computer with a dedicated graphics card.'],
  },
  SESSION_FAILED: {
    headline: 'The face engine could not start',
    explanation:
      'Creating the WebGPU model session failed. The app will not fall back to CPU inference. The error from the runtime is shown below.',
    steps: [
      'If the message says model files are missing, run bun run models:fetch and reload.',
      'If the message mentions the wasm runtime, host ort-wasm-simd-threaded.asyncify.wasm on R2 and rebuild with VITE_ORT_WASM_BASE_URL.',
      'Otherwise update GPU drivers, relaunch the browser, and try again.',
    ],
  },
  TOO_SLOW: {
    headline: 'This GPU is too slow for a class set of photos',
    explanation:
      'A short detection and embedding test took longer than 1.5 seconds. Scanning hundreds of photos here would not finish in a reasonable time, so the app stays closed.',
    steps: [
      'Close other GPU-heavy apps and reload.',
      'Use a computer with a stronger graphics card.',
    ],
  },
};

export const RESPONSIBILITY =
  'This tool only assists. You are responsible for checking every photo before you share it.';

export const PRIVACY_STATEMENT =
  'Photos and face data never leave this browser. This site makes no network requests except for its own files and, if you choose the Accurate model, the model download.';

export const LICENSE_NOTICE =
  'Face models are InsightFace pretrained weights, for non-commercial research use only. Redact Faces stays free.';
