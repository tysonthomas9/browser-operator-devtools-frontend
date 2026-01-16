import { create } from 'zustand';
import type { CellResult } from '../types';

export type ModalType = 'createTable' | 'addEntity' | 'addAgent' | 'cellDetail' | null;

interface ModalStore {
  activeModal: ModalType;
  cellDetailData: {
    entityId: string;
    agentGroupId: string;
    result: CellResult;
  } | null;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  openCellDetail: (entityId: string, agentGroupId: string, result: CellResult) => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModal: null,
  cellDetailData: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null, cellDetailData: null }),
  openCellDetail: (entityId, agentGroupId, result) => set({
    cellDetailData: { entityId, agentGroupId, result },
    activeModal: 'cellDetail',
  }),
}));

// Legacy exports for backward compatibility (non-reactive, use only for imperative code)
export const activeModal = { get value() { return useModalStore.getState().activeModal; } };
export const cellDetailData = { get value() { return useModalStore.getState().cellDetailData; } };
export const openModal = (modal: ModalType) => useModalStore.getState().openModal(modal);
export const closeModal = () => useModalStore.getState().closeModal();
export const openCellDetail = (entityId: string, agentGroupId: string, result: CellResult) =>
  useModalStore.getState().openCellDetail(entityId, agentGroupId, result);
