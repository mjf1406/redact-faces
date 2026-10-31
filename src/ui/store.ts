import { create } from 'zustand';

export type ScanState = {
  running: boolean;
  paused: boolean;
  done: number;
  total: number;
  current: string | null;
  message: string | null;
};

type UiState = {
  warnSlow: boolean;
  medianMs: number | null;
  deviceLost: string | null;
  lockMessage: string | null;
  scan: ScanState;
  selectedFaceIds: string[];
  reviewFilter: 'all' | 'unresolved' | 'redactions' | 'errors';
  reviewIndex: number;
  setWarn: (warnSlow: boolean, medianMs: number | null) => void;
  setDeviceLost: (deviceLost: string | null) => void;
  setLockMessage: (lockMessage: string | null) => void;
  setReviewFilter: (reviewFilter: UiState['reviewFilter']) => void;
  setReviewIndex: (reviewIndex: number) => void;
  toggleSelected: (id: string, range: string[] | null) => void;
  clearSelected: () => void;
};

const idleScan: ScanState = {
  running: false,
  paused: false,
  done: 0,
  total: 0,
  current: null,
  message: null,
};

export const useUi = create<UiState>((set) => ({
  warnSlow: false,
  medianMs: null,
  deviceLost: null,
  lockMessage: null,
  scan: idleScan,
  selectedFaceIds: [],
  reviewFilter: 'all',
  reviewIndex: 0,
  setWarn: (warnSlow, medianMs) => set({ warnSlow, medianMs }),
  setDeviceLost: (deviceLost) => set({ deviceLost }),
  setLockMessage: (lockMessage) => set({ lockMessage }),
  setReviewFilter: (reviewFilter) => set({ reviewFilter, reviewIndex: 0 }),
  setReviewIndex: (reviewIndex) => set({ reviewIndex }),
  clearSelected: () => set({ selectedFaceIds: [] }),
  toggleSelected: (id, range) =>
    set((state) => {
      if (!range) {
        const has = state.selectedFaceIds.includes(id);
        return {
          selectedFaceIds: has
            ? state.selectedFaceIds.filter((item) => item !== id)
            : [...state.selectedFaceIds, id],
        };
      }
      const current = new Set(state.selectedFaceIds);
      const start = range.indexOf(state.selectedFaceIds.at(-1) ?? id);
      const end = range.indexOf(id);
      const [from, to] =
        start < 0 || end < 0 ? [end, end] : start < end ? [start, end] : [end, start];
      for (let i = from; i <= to; i += 1) current.add(range[i]);
      return { selectedFaceIds: [...current] };
    }),
}));
