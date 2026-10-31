import { Button } from '@/components/ui/button';
import { Page, SiteHeader } from '@/components/site-header';
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
    <Page>
      <SiteHeader title={copy.headline} />
      <p className="text-sm text-muted-foreground">{copy.explanation}</p>
      {errorText ? (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-sm text-destructive">
          {errorText}
        </pre>
      ) : null}
      <section className="grid gap-2">
        <h2 className="font-heading text-base font-medium">What to do</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(diagnostics);
          }}
        >
          Copy diagnostics
        </Button>
      </div>
    </Page>
  );
}
