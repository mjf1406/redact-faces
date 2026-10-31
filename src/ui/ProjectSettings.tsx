import { Link, useCanGoBack, useParams, useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { SettingsTab } from './SettingsTab';

export function ProjectSettings() {
  const { projectId } = useParams({ from: '/p/$projectId/settings' });
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <SettingsTab projectId={projectId} />
      <div className="mt-6">
        {canGoBack ? (
          <Button type="button" variant="outline" onClick={() => router.history.back()}>
            Back
          </Button>
        ) : (
          <Button variant="outline" render={<Link to="/p/$projectId" params={{ projectId }} />}>
            Back
          </Button>
        )}
      </div>
    </section>
  );
}
