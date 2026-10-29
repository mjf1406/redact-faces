import Dexie from 'dexie';
import type { ModelPack, ProjectSettings } from '../engine/constants';
import { DB_NAME, defaultSettings } from '../engine/constants';
import { createId } from '../lib/id';
import { db } from './db';
import { releaseProjectLock } from './locks';

export async function persistStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function createProject(name: string, modelPack: ModelPack) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a project name.');
  const count = await db.projects.count();
  if (count === 0) await persistStorage();
  const project = {
    id: createId(),
    name: trimmed,
    createdAt: Date.now(),
    modelPack,
    settings: defaultSettings(),
    dirHandle: null,
  };
  await db.projects.add(project);
  return project.id;
}

export async function deleteProject(projectId: string) {
  await db.transaction('rw', db.projects, db.students, db.photos, db.faces, async () => {
    await db.faces.where('projectId').equals(projectId).delete();
    await db.photos.where('projectId').equals(projectId).delete();
    await db.students.where('projectId').equals(projectId).delete();
    await db.projects.delete(projectId);
  });
  releaseProjectLock(projectId);
}

export async function deleteAllData() {
  db.close();
  await Dexie.delete(DB_NAME);
  location.reload();
}

export async function updateSettings(projectId: string, patch: Partial<ProjectSettings>) {
  const project = await db.projects.get(projectId);
  if (!project) return;
  await db.projects.update(projectId, { settings: { ...project.settings, ...patch } });
}
