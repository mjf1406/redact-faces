import { Link, useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ExportTab } from './ExportTab';
import { GuessStep } from './GuessStep';
import { NameStep } from './NameStep';
import { PermissionStep } from './PermissionStep';
import { PhotosTab } from './PhotosTab';
import { ReviewTab } from './ReviewTab';
import { FLOW_STEPS } from './steps';
import { useUi } from './store';

export function Wizard() {
  const { projectId, step } = useParams({ from: '/p/$projectId/$step' });
  const scan = useUi((state) => state.scan);
  const index = Math.max(
    0,
    FLOW_STEPS.findIndex((item) => item.id === step),
  );
  const current = FLOW_STEPS[index];
  const nextDisabled = step === 'photos' && scan.running;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Progress value={((index + 1) / FLOW_STEPS.length) * 100}>
          <p className="text-sm font-medium">
            Step {index + 1} of {FLOW_STEPS.length}
          </p>
        </Progress>
        <ol className="hidden gap-2 md:grid md:grid-cols-6">
          {FLOW_STEPS.map((item, itemIndex) => (
            <li key={item.id}>
              <StepLink
                projectId={projectId}
                index={itemIndex}
                step={item.id}
                title={item.label}
                current={index}
              />
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2 md:hidden">
          {FLOW_STEPS.map((item, itemIndex) => (
            <Link
              key={item.id}
              to="/p/$projectId/$step"
              params={{ projectId, step: item.id }}
              aria-label={item.label}
              aria-current={itemIndex === index ? 'step' : undefined}
              className={cn(
                'size-2.5 rounded-full',
                itemIndex === index
                  ? 'bg-primary'
                  : itemIndex < index
                    ? 'bg-primary/50'
                    : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.help}</p>
          </div>
          {step === 'photos' ? <PhotosTab projectId={projectId} /> : null}
          {step === 'names' ? <NameStep projectId={projectId} /> : null}
          {step === 'guesses' ? <GuessStep projectId={projectId} /> : null}
          {step === 'permission' ? <PermissionStep projectId={projectId} /> : null}
          {step === 'review' ? <ReviewTab projectId={projectId} /> : null}
          {step === 'export' ? <ExportTab projectId={projectId} /> : null}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          {index === 0 ? (
            <Button type="button" variant="outline" disabled>
              Back
            </Button>
          ) : (
            <Button
              variant="outline"
              render={
                <Link
                  to="/p/$projectId/$step"
                  params={{ projectId, step: FLOW_STEPS[index - 1].id }}
                />
              }
            >
              Back
            </Button>
          )}
          {index < FLOW_STEPS.length - 1 ? (
            nextDisabled ? (
              <Button type="button" disabled>
                Next
              </Button>
            ) : (
              <Button
                render={
                  <Link
                    to="/p/$projectId/$step"
                    params={{ projectId, step: FLOW_STEPS[index + 1].id }}
                  />
                }
              >
                Next
              </Button>
            )
          ) : (
            <span />
          )}
        </div>
      </div>
    </section>
  );
}

function StepLink({
  projectId,
  index,
  step,
  title,
  current,
}: {
  projectId: string;
  index: number;
  step: (typeof FLOW_STEPS)[number]['id'];
  title: string;
  current: number;
}) {
  const done = index < current;
  return (
    <Link
      to="/p/$projectId/$step"
      params={{ projectId, step }}
      aria-current={index === current ? 'step' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
        index === current
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'grid size-5 shrink-0 place-content-center rounded-full text-[11px] font-medium',
          index === current
            ? 'bg-primary text-primary-foreground'
            : done
              ? 'bg-primary/20 text-foreground'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {index + 1}
      </span>
      <span className="truncate">{title}</span>
    </Link>
  );
}
