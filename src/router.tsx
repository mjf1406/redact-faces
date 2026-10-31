import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  useParams,
} from '@tanstack/react-router';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { Page, SiteHeader } from '@/components/site-header';
import { Button } from '@/components/ui/button';
import { isFlowStep } from './ui/steps';
import { ProjectFrame } from './ui/ProjectFrame';
import { ProjectHome } from './ui/ProjectHome';
import { ProjectOverview } from './ui/ProjectOverview';
import { ProjectSettings } from './ui/ProjectSettings';
import { Wizard } from './ui/Wizard';

function NotFound() {
  return (
    <Page>
      <SiteHeader title="Page not found" crumbs={<AppBreadcrumbs page="home" />} />
      <p className="text-sm text-muted-foreground">That page does not exist.</p>
      <div>
        <Button variant="outline" render={<Link to="/" />}>
          All projects
        </Button>
      </div>
    </Page>
  );
}

function ProjectIndex() {
  const { projectId } = useParams({ from: '/p/$projectId' });
  return <ProjectOverview projectId={projectId} />;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ProjectHome,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$projectId',
  component: ProjectFrame,
});

const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/',
  component: ProjectIndex,
});

const settingsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'settings',
  component: ProjectSettings,
});

const stepRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '$step',
  params: {
    parse: ({ step }) => (isFlowStep(step) ? { step } : false),
    stringify: ({ step }) => ({ step }),
  },
  component: Wizard,
});

const unknownProjectRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '$',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/p/$projectId',
      params: { projectId: params.projectId },
    });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectRoute.addChildren([projectIndexRoute, settingsRoute, stepRoute, unknownProjectRoute]),
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
