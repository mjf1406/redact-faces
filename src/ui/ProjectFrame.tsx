import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, Outlet, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { CircleAlert } from 'lucide-react';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { Page, SiteHeader } from '@/components/site-header';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { db } from '../db/db';
import { releaseProjectLock, waitForProjectLock } from '../db/locks';
import { LICENSE_NOTICE, RESPONSIBILITY } from '../gate/copy';
import { isFlowStep, type FlowStep } from './steps';
import { useUi } from './store';

type Access =
  | { status: 'pending' }
  | { status: 'missing' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

function projectSection(projectId: string, pathname: string): 'project' | 'settings' | FlowStep {
  const base = `/p/${encodeURIComponent(projectId)}`;
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (path === base) return 'project';
  if (path === `${base}/settings`) return 'settings';
  const step = path.slice(base.length + 1);
  return isFlowStep(step) ? step : 'project';
}

export function ProjectFrame() {
  const { projectId } = useParams({ from: '/p/$projectId' });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
  const deviceLost = useUi((state) => state.deviceLost);
  const warnSlow = useUi((state) => state.warnSlow);
  const medianMs = useUi((state) => state.medianMs);
  const [access, setAccess] = useState<Access>({ status: 'pending' });
  const section = projectSection(projectId, pathname);
  const projectName = project?.name ?? 'Opening project…';
  const crumbs =
    section === 'project' ? (
      <AppBreadcrumbs page="project" projectId={projectId} projectName={projectName} />
    ) : section === 'settings' ? (
      <AppBreadcrumbs page="settings" projectId={projectId} projectName={projectName} />
    ) : (
      <AppBreadcrumbs page="step" projectId={projectId} projectName={projectName} step={section} />
    );

  useEffect(() => {
    let cancelled = false;
    setAccess({ status: 'pending' });
    useUi.getState().clearSelected();
    useUi.getState().setReviewIndex(0);
    void (async () => {
      const record = await db.projects.get(projectId);
      if (cancelled) return;
      if (!record) {
        setAccess({ status: 'missing' });
        return;
      }
      const lock = await waitForProjectLock(projectId);
      if (cancelled) {
        if (lock === 'acquired') releaseProjectLock(projectId);
        return;
      }
      if (lock === 'busy') {
        useUi.getState().setLockMessage('This project is already open in another tab.');
        void navigate({ to: '/' });
        return;
      }
      try {
        await db.photos
          .where('[projectId+status]')
          .equals([projectId, 'processing'])
          .modify({ status: 'pending' });
      } catch (reason: unknown) {
        if (cancelled) return;
        setAccess({
          status: 'error',
          message: reason instanceof Error ? reason.message : 'Could not open this project.',
        });
        return;
      }
      if (cancelled) return;
      useUi.getState().setLockMessage(null);
      setAccess({ status: 'ready' });
    })();
    return () => {
      cancelled = true;
      releaseProjectLock(projectId);
    };
  }, [navigate, projectId]);

  if (access.status === 'pending') {
    return (
      <Page>
        <SiteHeader title={projectName} crumbs={crumbs} />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      </Page>
    );
  }

  if (access.status === 'missing') {
    return (
      <Page>
        <SiteHeader
          title="Project not found"
          crumbs={<AppBreadcrumbs page="home" />}
          actions={
            <Button variant="outline" render={<Link to="/" />}>
              All projects
            </Button>
          }
        />
        <p className="text-sm text-muted-foreground">
          That project is not stored on this computer.
        </p>
      </Page>
    );
  }

  if (access.status === 'error') {
    return (
      <Page>
        <SiteHeader title={projectName} crumbs={crumbs} />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{access.message}</AlertDescription>
        </Alert>
      </Page>
    );
  }

  return (
    <Page>
      <SiteHeader
        title={projectName}
        crumbs={crumbs}
        actions={
          <Button
            variant={section === 'settings' ? 'default' : 'outline'}
            aria-current={section === 'settings' ? 'page' : undefined}
            render={<Link to="/p/$projectId/settings" params={{ projectId }} />}
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
      <Outlet />
      <footer className="text-xs text-muted-foreground">
        <p>{LICENSE_NOTICE}</p>
      </footer>
    </Page>
  );
}
