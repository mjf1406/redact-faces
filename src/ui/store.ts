import { create } from 'zustand';
import type { ExportSummary } from '../export/runExport';
import type { FlowStep } from './steps';

export type ProjectScreen = 'home' | 'wizard';
export type WizardStep = FlowStep | 'settings';

export type ScanState = {
  running: boolean;
  paused: boolean;
  done: number;
  total: number;
  current: string | null;
  message: string | null;
};

type UiState = {
  projectId: string | null;
  screen: ProjectScreen;
  step: WizardStep;
  warnSlow: boolean;
  medianMs: number | null;
  deviceLost: string | null;
  lockMessage: string | null;
  scan: ScanState;
  selectedFaceIds: string[];
  reviewFilter: 'all' | 'unresolved' | 'redactions' | 'errors';
  reviewIndex: number;
  setProject: (projectId: string | null) => void;
  setScreen: (screen: ProjectScreen) => void;
  setStep: (step: WizardStep) => void;
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
  projectId: null,
  screen: 'home',
  step: 'photos',
  warnSlow: false,
  medianMs: null,
  deviceLost: null,
  lockMessage: null,
  scan: idleScan,
  selectedFaceIds: [],
  reviewFilter: 'all',
  reviewIndex: 0,
  setProject: (projectId) =>
    set({
      projectId,
      screen: 'home',
      step: 'photos',
      selectedFaceIds: [],
      reviewIndex: 0,
    }),
  setScreen: (screen) => set(screen === 'home' ? { screen, step: 'photos' } : { screen }),
  setStep: (step) => set(step === 'settings' ? { step } : { step, screen: 'wizard' }),
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

export type { ExportSummary };
