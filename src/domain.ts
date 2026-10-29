import type {
  Consent,
  DetectionMode,
  FaceSource,
  FaceState,
  MaxExportDimension,
  ModelPack,
  NormBox,
  NormPoint,
  PhotoStatus,
  ProjectSettings,
} from './engine/constants';

export type {
  Consent,
  DetectionMode,
  FaceSource,
  FaceState,
  MaxExportDimension,
  ModelPack,
  NormBox,
  NormPoint,
  PhotoStatus,
  ProjectSettings,
};

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: number;
  modelPack: ModelPack;
  settings: ProjectSettings;
  dirHandle: FileSystemDirectoryHandle | null;
};

export type StudentRecord = {
  id: string;
  projectId: string;
  name: string;
  consent: Consent;
};

export type PhotoRecord = {
  id: string;
  projectId: string;
  relPath: string;
  size: number;
  lastModified: number;
  width: number;
  height: number;
  status: PhotoStatus;
  error: string | null;
  thumb: Blob | null;
};

export type FaceRecord = {
  id: string;
  projectId: string;
  photoId: string;
  box: NormBox;
  kps: NormPoint[];
  score: number;
  lowConfidence: boolean;
  embedding: Float32Array | null;
  embModel: string | null;
  crop: Blob | null;
  state: FaceState;
  studentId: string | null;
  suggestedStudentId: string | null;
  suggestionScore: number | null;
  source: FaceSource;
};

export type RedactFace = Pick<
  FaceRecord,
  'source' | 'state' | 'studentId' | 'suggestedStudentId' | 'box' | 'kps'
>;

export type RedactStudent = Pick<StudentRecord, 'id' | 'consent'>;
