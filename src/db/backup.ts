import { z } from 'zod';
import { defaultSettings, type ProjectSettings } from '../engine/constants';

const settingsSchema = z.object({
  detectionMode: z.enum(['fast', 'thorough', 'maximum']),
  suggestThreshold: z.number(),
  suggestMargin: z.number(),
  clusterThreshold: z.number(),
  redactionPadding: z.number(),
  jpegQuality: z.number(),
  maxExportDimension: z.union([z.literal(3840), z.literal(2560), z.literal(1920), z.null()]),
});

const pointSchema = z.object({ x: z.number(), y: z.number() });

export const backupSchema = z.object({
  version: z.literal(1),
  project: z.object({
    name: z.string().min(1),
    modelPack: z.enum(['fast', 'accurate']),
    settings: settingsSchema,
  }),
  students: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      consent: z.enum(['yes', 'no']).nullable(),
    }),
  ),
  photos: z.array(
    z.object({
      relPath: z.string().min(1),
      size: z.number(),
      lastModified: z.number(),
      width: z.number(),
      height: z.number(),
      faces: z.array(
        z.object({
          box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
          kps: z.array(pointSchema),
          score: z.number(),
          lowConfidence: z.boolean(),
          source: z.enum(['detector', 'manual']),
          state: z.enum(['unassigned', 'suggested', 'confirmed', 'safe', 'falsePositive']),
          studentId: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export type BackupFile = z.infer<typeof backupSchema>;

export function parseBackup(input: unknown) {
  return backupSchema.safeParse(input);
}

export function emptyBackup(
  name: string,
  settings: ProjectSettings = defaultSettings(),
): BackupFile {
  return {
    version: 1,
    project: { name, modelPack: 'fast', settings },
    students: [],
    photos: [],
  };
}
