import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CircleAlert } from 'lucide-react';
import { Page, SiteHeader } from '@/components/site-header';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { db } from '../db/db';
import { LICENSE_NOTICE, RESPONSIBILITY } from '../gate/copy';
import { ExportTab } from './ExportTab';
import { GuessStep } from './GuessStep';
import { NameStep } from './NameStep';
import { PermissionStep } from './PermissionStep';
import { PhotosTab } from './PhotosTab';
import { ProjectOverview } from './ProjectOverview';
import { ReviewTab } from './ReviewTab';
import { SettingsTab } from './SettingsTab';
import { FLOW_STEPS } from './steps';
import { useUi, type WizardStep } from './store';

export function Workspace({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const screen = useUi((state) => state.screen);
  const step = useUi((state) => state.step);
  const setStep = useUi((state) => state.setStep);
  const setScreen = useUi((state) => state.setScreen);
  const deviceLost = useUi((state) => state.deviceLost);
  const warnSlow = useUi((state) => state.warnSlow);
  const medianMs = useUi((state) => state.medianMs);
  const scan = useUi((state) => state.scan);
  const [settingsReturn, setSettingsReturn] = useState<'home' | WizardStep>('home');
  const index = Math.max(
    0,
    FLOW_STEPS.findIndex((item) => item.id === step),
  );
  const current = FLOW_STEPS[index];

  function openSettings() {
    if (step !== 'settings') setSettingsReturn(screen === 'home' ? 'home' : step);
    setStep('settings');
  }

  function closeSettings() {
    if (settingsReturn === 'home') setScreen('home');
    else setStep(settingsReturn);
  }

  return (
    <Page>
      <SiteHeader
        title={project?.name ?? 'Project'}
        actions={
          <Button
            type="button"
            variant={step === 'settings' ? 'default' : 'outline'}
            aria-pressed={step === 'settings'}
            onClick={openSettings}
          >
            Project Settings
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">{RESPONSIBILITY}</p>
      {warnSlow ? (
        <Alert>
          <AlertDescription className="text-foreground">
            This GPU is usable, but a test pass took {Math.round(medianMs ?? 0)} ms. Large folders
            will be slow.
          </AlertDescription>
        </Alert>
      ) : null}
      {deviceLost ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>
            The graphics device was lost. The scan stopped. {deviceLost}
          </AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" variant="outline" onClick={() => location.reload()}>
              Restart engine
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {step === 'settings' ? (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <SettingsTab projectId={projectId} />
          <div className="mt-6">
            <Button type="button" variant="outline" onClick={closeSettings}>
              Back
            </Button>
          </div>
        </section>
      ) : screen === 'home' ? (
        <ProjectOverview projectId={projectId} />
      ) : (
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
                  <StepButton
                    index={itemIndex}
                    title={item.label}
                    current={index}
                    onSelect={() => setStep(item.id)}
                  />
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 md:hidden">
              {FLOW_STEPS.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
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
                  onClick={() => setStep(item.id)}
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
              <Button
                type="button"
                variant="outline"
                disabled={index === 0}
                onClick={() => setStep(FLOW_STEPS[index - 1].id)}
              >
                Back
              </Button>
              {index < FLOW_STEPS.length - 1 ? (
                <Button
                  type="button"
                  disabled={step === 'photos' && scan.running}
                  onClick={() => setStep(FLOW_STEPS[index + 1].id)}
                >
                  Next
                </Button>
              ) : (
                <span />
              )}
            </div>
          </div>
        </section>
      )}
      <footer className="text-xs text-muted-foreground">
        <p>{LICENSE_NOTICE}</p>
      </footer>
    </Page>
  );
}

function StepButton({
  index,
  title,
  current,
  onSelect,
}: {
  index: number;
  title: string;
  current: number;
  onSelect: () => void;
}) {
  const done = index < current;
  return (
    <button
      type="button"
      aria-current={index === current ? 'step' : undefined}
      onClick={onSelect}
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
    </button>
  );
}
