import { create } from 'zustand';

interface LayoutState {
  channelSidebarOpen: boolean;
  membersSidebarOpen: boolean;
  calendarOpen: boolean;
  blogOpen: boolean;
  newsletterOpen: boolean;
  mobileView: 'sidebar' | 'chat';
  toggleChannelSidebar: () => void;
  toggleMembersSidebar: () => void;
  setCalendarOpen: (open: boolean) => void;
  setBlogOpen: (open: boolean) => void;
  setNewsletterOpen: (open: boolean) => void;
  setMobileView: (view: 'sidebar' | 'chat') => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  channelSidebarOpen: localStorage.getItem('channelSidebarOpen') !== 'false',
  membersSidebarOpen: localStorage.getItem('membersSidebarOpen') !== 'false',
  calendarOpen: false,
  blogOpen: false,
  newsletterOpen: false,
  mobileView: 'sidebar',
  setCalendarOpen: (open) => set({ calendarOpen: open, blogOpen: false, newsletterOpen: false }),
  setBlogOpen: (open) => set({ blogOpen: open, calendarOpen: false, newsletterOpen: false }),
  setNewsletterOpen: (open) => set({ newsletterOpen: open, calendarOpen: false, blogOpen: false }),
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
