import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { db } from '../db/db';
import { projectStepProgress, wizardStartStep, type StepStatus } from './projectProgress';
import { FLOW_STEPS } from './steps';

const statusLabel: Record<StepStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
  ready: 'Ready',
};

export function ProjectOverview({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const photos = useLiveQuery(
    () => db.photos.where('projectId').equals(projectId).toArray(),
    [projectId],
  );
  const faces = useLiveQuery(
    () => db.faces.where('projectId').equals(projectId).toArray(),
    [projectId],
  );
  const students = useLiveQuery(
    () => db.students.where('projectId').equals(projectId).toArray(),
    [projectId],
  );
  if (!project || !photos || !faces || !students) return null;

  const progress = projectStepProgress({
    hasFolder: project.dirHandle != null,
    photos,
    faces,
    students,
  });
  const byId = new Map(progress.map((item) => [item.id, item]));
  const start = wizardStartStep(progress);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          size="lg"
          className="h-12 w-full px-10 text-base lg:w-auto lg:min-w-72"
          render={<Link to="/p/$projectId/$step" params={{ projectId, step: start }} />}
        >
          Start wizard
        </Button>
      </div>
      <section className="grid gap-3">
        <h2 className="font-heading text-lg font-medium">Progress</h2>
        <ol className="grid gap-3">
          {FLOW_STEPS.map((step, index) => {
            const item = byId.get(step.id);
            if (!item) return null;
            return (
              <li key={step.id}>
                <Link
                  to="/p/$projectId/$step"
                  params={{ projectId, step: step.id }}
                  className="flex w-full flex-col gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="grid size-6 shrink-0 place-content-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium">{step.title}</span>
                    </span>
                    <Badge
                      variant={
                        item.status === 'ready'
                          ? 'default'
                          : item.status === 'done'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {statusLabel[item.status]}
                    </Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">{item.detail}</span>
                  <StepMeter value={item.value} label={`${step.label} progress`} />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function StepMeter({ value, label }: { value: number; label: string }) {
  const text = `${value}%`;
  return (
    <div
      className="relative h-8 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
      <span className="pointer-events-none absolute inset-0 grid place-content-center text-sm font-medium text-foreground tabular-nums">
        {text}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid place-content-center text-sm font-medium text-primary-foreground tabular-nums"
        style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
      >
        {text}
      </span>
    </div>
  );
}
