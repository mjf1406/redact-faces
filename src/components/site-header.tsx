import type { ReactNode } from 'react';
import { DeleteAllData } from '@/components/delete-all-data';
import { ModeToggle } from '@/components/mode-toggle';

export function Page({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 p-6">{children}</main>
  );
}

export function SiteHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <p className="text-sm font-medium">Redact Faces</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <DeleteAllData />
        <ModeToggle />
      </div>
    </header>
  );
}
