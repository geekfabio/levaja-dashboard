import { create } from "zustand";

type UiState = {
  sidebarOpen: boolean;
  paletteOpen: boolean;
  helpOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  paletteOpen: false,
  helpOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
