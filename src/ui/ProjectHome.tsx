import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CircleAlert, EllipsisVertical, FolderOpen, Plus, Upload } from 'lucide-react';
import { AppBreadcrumbs } from '@/components/app-breadcrumbs';
import { Page, SiteHeader } from '@/components/site-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { db } from '../db/db';
import { createProject, deleteProject } from '../db/projects';
import { accuratePackEnabled } from '../engine/models';
import type { ModelPack } from '../engine/constants';
import type { ProjectRecord } from '../domain';
import { LICENSE_NOTICE, PRIVACY_STATEMENT, RESPONSIBILITY } from '../gate/copy';
import { parseBackup } from '../db/backup';
import { importBackup } from '../scan/importBackup';
import { useUi } from './store';

export function ProjectHome() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), []);
  const [name, setName] = useState('');
  const [pack, setPack] = useState<ModelPack>('fast');
  const [error, setError] = useState<string | null>(null);
  const [backupText, setBackupText] = useState<string | null>(null);
  const [importPack, setImportPack] = useState<ModelPack>('fast');
  const [fileKey, setFileKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const lockMessage = useUi((state) => state.lockMessage);
  const navigate = useNavigate();
  const accurate = accuratePackEnabled();

  function open(id: string) {
    void navigate({ to: '/p/$projectId', params: { projectId: id } });
  }

  function closeCreate(open: boolean) {
    setCreateOpen(open);
    if (!open) {
      setName('');
      setPack('fast');
    }
  }

  function closeImport(open: boolean) {
    setImportOpen(open);
    if (!open) {
      setBackupText(null);
      setImportPack('fast');
      setFileKey((key) => key + 1);
    }
  }

  return (
    <Page>
      <SiteHeader title="School-year projects" crumbs={<AppBreadcrumbs page="home" />} />
      <p className="text-sm text-muted-foreground">{RESPONSIBILITY}</p>
      {lockMessage ? (
        <Alert>
          <AlertDescription className="text-foreground">{lockMessage}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-medium">Projects</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus />
              Create project
            </Button>
          </div>
        </div>
        {projects === undefined ? null : projects.length === 0 ? (
          <EmptyProjects />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createProject(name, pack)
                .then((id) => {
                  closeCreate(false);
                  return open(id);
                })
                .catch((reason: unknown) =>
                  setError(
                    reason instanceof Error ? reason.message : 'Could not create the project.',
                  ),
                );
            }}
          >
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>Name the school year and choose a model pack.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="project-name">School year or name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <PackChoice
              id="new-pack"
              legend="Model pack"
              value={pack}
              onChange={setPack}
              accurate={accurate}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closeCreate(false)}>
                Cancel
              </Button>
              <Button type="submit">Create project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={importOpen} onOpenChange={closeImport}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!backupText) return;
              const parsed = parseBackup(JSON.parse(backupText) as unknown);
              if (!parsed.success) return;
              void window
                .showDirectoryPicker({ mode: 'read' })
                .then((dir) => importBackup(parsed.data, importPack, dir))
                .then(async (result) => {
                  if (result.unmatched.length > 0) {
                    setError(
                      `Imported. These photos did not match a file: ${result.unmatched.join(', ')}`,
                    );
                  }
                  closeImport(false);
                  open(result.id);
                })
                .catch((reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : 'Import failed.'),
                );
            }}
          >
            <DialogHeader>
              <DialogTitle>Import a backup</DialogTitle>
              <DialogDescription>
                The file contains student names and consent. Treat it as sensitive data.
              </DialogDescription>
            </DialogHeader>
            <Input
              key={fileKey}
              type="file"
              accept="application/json,.json"
              aria-label="Backup file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  const parsed = parseBackup(JSON.parse(text) as unknown);
                  if (!parsed.success) {
                    setError('That backup file is not valid.');
                    setBackupText(null);
                    return;
                  }
                  setBackupText(text);
                  setError(null);
                });
              }}
            />
            {backupText ? (
              <PackChoice
                id="import-pack"
                legend="Model pack for the new embeddings"
                value={importPack}
                onChange={setImportPack}
                accurate={accurate}
              />
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closeImport(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!backupText}>
                Choose photo folder and import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <footer className="grid gap-2 text-xs text-muted-foreground">
        <p>{PRIVACY_STATEMENT}</p>
        <p>{LICENSE_NOTICE}</p>
      </footer>
    </Page>
  );
}

function EmptyProjects() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FolderOpen className="size-5" />
      </div>
      <div className="grid max-w-sm gap-1">
        <p className="font-medium">No projects yet</p>
        <p className="text-sm text-muted-foreground">
          Create a school-year project, or import a backup to restore one.
        </p>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectRecord }) {
  const created = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    project.createdAt,
  );

  return (
    <Card className="relative transition-colors hover:bg-muted/40">
      <Link
        to="/p/$projectId"
        params={{ projectId: project.id }}
        className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="sr-only">Open {project.name}</span>
      </Link>
      <CardHeader className="pointer-events-none">
        <CardTitle className="pr-8">{project.name}</CardTitle>
        <CardDescription>{created}</CardDescription>
        <CardAction className="pointer-events-auto relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${project.name}`}
                />
              }
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void deleteProject(project.id)}
              >
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="pointer-events-none">
        <Badge variant="secondary" className="capitalize">
          {project.modelPack}
        </Badge>
      </CardContent>
    </Card>
  );
}

function PackChoice({
  id,
  legend,
  value,
  onChange,
  accurate,
}: {
  id: string;
  legend: string;
  value: ModelPack;
  onChange: (value: ModelPack) => void;
  accurate: boolean;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          if (next === 'fast' || next === 'accurate') onChange(next);
        }}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="fast" id={`${id}-fast`} />
          <Label htmlFor={`${id}-fast`}>Fast</Label>
        </div>
        {accurate ? (
          <div className="flex items-center gap-2">
            <RadioGroupItem value="accurate" id={`${id}-accurate`} />
            <Label htmlFor={`${id}-accurate`}>Accurate</Label>
          </div>
        ) : null}
      </RadioGroup>
    </fieldset>
  );
}
