import { create } from 'zustand';

interface LayoutState {
  spaceSidebarOpen: boolean;
  channelSidebarOpen: boolean;
  membersSidebarOpen: boolean;
  mobileView: 'sidebar' | 'chat';
  toggleSpaceSidebar: () => void;
  toggleChannelSidebar: () => void;
  toggleMembersSidebar: () => void;
  setMobileView: (view: 'sidebar' | 'chat') => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  spaceSidebarOpen: localStorage.getItem('spaceSidebarOpen') !== 'false',
  channelSidebarOpen: localStorage.getItem('channelSidebarOpen') !== 'false',
  membersSidebarOpen: localStorage.getItem('membersSidebarOpen') !== 'false',
  mobileView: 'sidebar',
  toggleSpaceSidebar: () =>
    set((s) => {
      const next = !s.spaceSidebarOpen;
      localStorage.setItem('spaceSidebarOpen', String(next));
      return { spaceSidebarOpen: next };
    }),
  toggleChannelSidebar: () =>
    set((s) => {
      const next = !s.channelSidebarOpen;
      localStorage.setItem('channelSidebarOpen', String(next));
      return { channelSidebarOpen: next };
    }),
  toggleMembersSidebar: () =>
    set((s) => {
      const next = !s.membersSidebarOpen;
      localStorage.setItem('membersSidebarOpen', String(next));
      return { membersSidebarOpen: next };
    }),
  setMobileView: (view) => set({ mobileView: view }),
}));
