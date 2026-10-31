import { Link } from '@tanstack/react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { FLOW_STEPS, type FlowStep } from '@/ui/steps';

type AppBreadcrumbsProps =
  | { page: 'home' }
  | { page: 'project'; projectId: string; projectName: string }
  | { page: 'settings'; projectId: string; projectName: string }
  | { page: 'step'; projectId: string; projectName: string; step: FlowStep };

export function AppBreadcrumbs(props: AppBreadcrumbsProps) {
  const section =
    props.page === 'settings'
      ? 'Settings'
      : props.page === 'step'
        ? FLOW_STEPS.find((step) => step.id === props.step)?.label
        : null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {props.page === 'home' ? (
            <BreadcrumbPage>Redact Faces</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link to="/" activeOptions={{ exact: true }} />}>
              Redact Faces
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {props.page === 'home' ? null : (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {props.page === 'project' ? (
                <BreadcrumbPage>{props.projectName}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  render={
                    <Link
                      to="/p/$projectId"
                      params={{ projectId: props.projectId }}
                      activeOptions={{ exact: true }}
                    />
                  }
                >
                  {props.projectName}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </>
        )}
        {section ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{section}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
