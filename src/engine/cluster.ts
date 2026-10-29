import { CLUSTER_MIN_SCORE, CLUSTER_MIN_SIDE_PX, type FaceState, type NormBox } from './constants';
import { dot, meanNormalize } from './vector';

export type ClusterFace = { id: string; embedding: Float32Array };

type Acc = { ids: string[]; rows: Float32Array[]; centroid: Float32Array };

export function isClusterEligible(face: {
  score: number;
  box: NormBox;
  width: number;
  height: number;
  state: FaceState;
  embedding: Float32Array | null;
}) {
  if (face.state !== 'unassigned' || !face.embedding) return false;
  if (face.score < CLUSTER_MIN_SCORE) return false;
  const side = Math.min(face.box.w * face.width, face.box.h * face.height);
  return side >= CLUSTER_MIN_SIDE_PX;
}

function nearest(centroid: Float32Array, clusters: Acc[]) {
  let best = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < clusters.length; i += 1) {
    const score = dot(centroid, clusters[i].centroid);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return { index: best, score: bestScore };
}

function online(faces: ClusterFace[], threshold: number) {
  const clusters: Acc[] = [];
  for (const face of faces) {
    const hit = nearest(face.embedding, clusters);
    if (hit.index >= 0 && hit.score >= threshold) {
      const cluster = clusters[hit.index];
      cluster.ids.push(face.id);
      cluster.rows.push(face.embedding);
      cluster.centroid = meanNormalize(cluster.rows);
    } else {
      clusters.push({ ids: [face.id], rows: [face.embedding], centroid: face.embedding });
    }
  }
  return clusters;
}

function reassign(clusters: Acc[], faces: ClusterFace[]) {
  if (clusters.length === 0) return [];
  const buckets: Acc[] = clusters.map((cluster) => ({
    ids: [],
    rows: [],
    centroid: cluster.centroid,
  }));
  for (const face of faces) {
    const hit = nearest(face.embedding, buckets);
    const bucket = buckets[hit.index];
    bucket.ids.push(face.id);
    bucket.rows.push(face.embedding);
  }
  return buckets
    .filter((bucket) => bucket.rows.length > 0)
    .map((bucket) => ({ ...bucket, centroid: meanNormalize(bucket.rows) }));
}

function mergeClose(clusters: Acc[], threshold: number) {
  const kept: Acc[] = [];
  for (const cluster of clusters) {
    const hit = nearest(cluster.centroid, kept);
    if (hit.index >= 0 && hit.score >= threshold) {
      const target = kept[hit.index];
      target.ids.push(...cluster.ids);
      target.rows.push(...cluster.rows);
      target.centroid = meanNormalize(target.rows);
    } else {
      kept.push({
        ids: [...cluster.ids],
        rows: [...cluster.rows],
        centroid: cluster.centroid,
      });
    }
  }
  return kept;
}

export function clusterFaces(faces: ClusterFace[], threshold: number) {
  let clusters = online(faces, threshold);
  for (let pass = 0; pass < 2; pass += 1) {
    clusters = reassign(clusters, faces);
    clusters = mergeClose(clusters, threshold);
  }
  return clusters.map((cluster) => ({ faceIds: cluster.ids, centroid: cluster.centroid }));
}
