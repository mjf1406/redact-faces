// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { router } from './router';

function routeIds(path: string) {
  return router.matchRoutes(path).map((match) => match.routeId);
}

describe('project routes', () => {
  it('builds project urls', () => {
    expect(router.buildLocation({ to: '/' }).href).toBe('/');
    expect(router.buildLocation({ to: '/p/$projectId', params: { projectId: 'abc' } }).href).toBe(
      '/p/abc',
    );
    expect(
      router.buildLocation({
        to: '/p/$projectId/$step',
        params: { projectId: 'abc', step: 'photos' },
      }).href,
    ).toBe('/p/abc/photos');
    expect(
      router.buildLocation({ to: '/p/$projectId/settings', params: { projectId: 'abc' } }).href,
    ).toBe('/p/abc/settings');
  });

  it('keeps settings and steps on different routes', () => {
    expect(routeIds('/')).toContain('/');
    expect(routeIds('/p/abc')).toEqual(['__root__', '/p/$projectId', '/p/$projectId/']);
    expect(routeIds('/p/abc/settings')).toEqual([
      '__root__',
      '/p/$projectId',
      '/p/$projectId/settings',
    ]);
    expect(routeIds('/p/abc/photos')).toEqual(['__root__', '/p/$projectId', '/p/$projectId/$step']);
    expect(routeIds('/p/abc/nope')).toEqual(['__root__', '/p/$projectId', '/p/$projectId/$']);
  });

  it('sends an unknown step back to the project', async () => {
    await router.navigate({ href: '/p/abc/nope' });
    expect(router.state.location.pathname).toBe('/p/abc');
  });
});
