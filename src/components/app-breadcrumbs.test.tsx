// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { RouterContextProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { router } from '../router';
import { AppBreadcrumbs } from './app-breadcrumbs';

describe('breadcrumbs', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the current page on the project list', () => {
    const view = render(
      <RouterContextProvider router={router}>
        <AppBreadcrumbs page="home" />
      </RouterContextProvider>,
    );
    const current = view.getByRole('link', { name: 'Redact Faces' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.getAttribute('href')).toBeNull();
  });

  it('links back to the project list and the project', async () => {
    await router.navigate({
      to: '/p/$projectId/$step',
      params: { projectId: 'abc', step: 'photos' },
    });
    const view = render(
      <RouterContextProvider router={router}>
        <AppBreadcrumbs page="step" projectId="abc" projectName="Class 2026" step="photos" />
      </RouterContextProvider>,
    );
    expect(view.getByRole('link', { name: 'Redact Faces' }).getAttribute('href')).toBe('/');
    const project = view.getByRole('link', { name: 'Class 2026' });
    expect(project.getAttribute('href')).toBe('/p/abc');
    expect(project.getAttribute('aria-current')).toBeNull();
    const current = view.getByRole('link', { name: 'Photos' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.tagName).toBe('SPAN');
  });

  it('marks settings as the current page', () => {
    const view = render(
      <RouterContextProvider router={router}>
        <AppBreadcrumbs page="settings" projectId="abc" projectName="Class 2026" />
      </RouterContextProvider>,
    );
    expect(view.getByRole('link', { name: 'Class 2026' }).getAttribute('href')).toBe('/p/abc');
    expect(view.getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe('page');
  });
});
