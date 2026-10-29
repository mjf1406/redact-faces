import { GATE_COPY } from '../gate/copy';
import type { GateCode } from '../gate/evaluate';

export function GateScreen({
  code,
  errorText,
  diagnostics,
}: {
  code: GateCode;
  errorText: string | null;
  diagnostics: string;
}) {
  const copy = GATE_COPY[code];
  return (
    <main className="gate">
      <p className="brand">Redact Faces</p>
      <h1>{copy.headline}</h1>
      <p>{copy.explanation}</p>
      {errorText ? <pre className="error-text">{errorText}</pre> : null}
      <h2>What to do</h2>
      <ol>
        {copy.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(diagnostics);
        }}
      >
        Copy diagnostics
      </button>
    </main>
  );
}
