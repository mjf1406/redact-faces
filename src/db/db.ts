import Dexie, { type EntityTable } from 'dexie';
import type { FaceRecord, PhotoRecord, ProjectRecord, StudentRecord } from '../domain';
import { DB_NAME } from '../engine/constants';

export const db = new Dexie(DB_NAME) as Dexie & {
  projects: EntityTable<ProjectRecord, 'id'>;
  students: EntityTable<StudentRecord, 'id'>;
  photos: EntityTable<PhotoRecord, 'id'>;
  faces: EntityTable<FaceRecord, 'id'>;
};

db.version(1).stores({
  projects: 'id, createdAt',
  students: 'id, projectId, name',
  photos: 'id, projectId, relPath, status, [projectId+status]',
  faces:
    'id, projectId, photoId, studentId, suggestedStudentId, state, [projectId+photoId], [projectId+state]',
});
