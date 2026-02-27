export interface PublicThemeColors {
  pageBg: string;
  pageText: string;
  headerBg: string;
  headerBorder: string;
  headerBorderWidth: number;
  logoColor: string;
  navBtnColor: string;
  navBtnBorder: string;
  registerBtnBg: string;
  registerBtnColor: string;
  contentBg: string;
  contentBorder: string;
  contentRadius: number;
  accent: string;
  accentHover: string;
  linkColor: string;
  tableHeaderBg: string;
  tableHeaderColor: string;
  footerBorder: string;
  footerText: string;
  fontFamily: string;
  headingColor: string;
  mutedText: string;
  secondaryText: string;
  inputBg: string;
  inputBorder: string;
}

export interface PublicThemeLayout {
  forumPostLayout: 'sidebar' | 'stacked';
  forumChannelList: 'table' | 'cards';
  maxWidth: number;
}

export interface PublicTheme {
  id: string;
  name: string;
  description: string;
  colors: PublicThemeColors;
  layout: PublicThemeLayout;
}

const modernTheme: PublicTheme = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean, minimal light theme',
  colors: {
    pageBg: '#fafafa',
    pageText: '#333',
    headerBg: '#fff',
    headerBorder: '#e5e7eb',
    headerBorderWidth: 1,
    logoColor: '#111',
    navBtnColor: '#666',
    navBtnBorder: '#ddd',
    registerBtnBg: '#5865F2',
    registerBtnColor: '#fff',
    contentBg: '#fff',
    contentBorder: '#e5e7eb',
    contentRadius: 8,
    accent: '#5865F2',
    accentHover: '#4752c4',
    linkColor: '#5865F2',
    tableHeaderBg: '#f9fafb',
    tableHeaderColor: '#666',
    footerBorder: '#e5e7eb',
    footerText: '#999',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headingColor: '#111',
    mutedText: '#999',
    secondaryText: '#666',
    inputBg: '#fff',
    inputBorder: '#e5e7eb',
  },
  layout: {
    forumPostLayout: 'stacked',
    forumChannelList: 'cards',
    maxWidth: 1100,
  },
};

const classicForumTheme: PublicTheme = {
  id: 'classic-forum',
  name: 'Classic Forum',
  description: 'Retro 2000s forum aesthetic',
  colors: {
    pageBg: '#f4f0e8',
    pageText: '#333',
    headerBg: 'linear-gradient(180deg, #4a5568 0%, #2d3748 100%)',
    headerBorder: '#e2a33e',
    headerBorderWidth: 3,
    logoColor: '#fff',
    navBtnColor: '#ccc',
    navBtnBorder: 'rgba(255,255,255,0.2)',
    registerBtnBg: '#e2a33e',
    registerBtnColor: '#fff',
    contentBg: '#fff',
    contentBorder: '#ccc',
    contentRadius: 4,
    accent: '#e2a33e',
    accentHover: '#d4942f',
    linkColor: '#2b6cb0',
    tableHeaderBg: '#4a5568',
    tableHeaderColor: '#fff',
    footerBorder: '#ddd',
    footerText: '#999',
    fontFamily: '"Trebuchet MS", "Lucida Sans", Arial, sans-serif',
    headingColor: '#2d3748',
    mutedText: '#999',
    secondaryText: '#666',
    inputBg: '#fff',
    inputBorder: '#ccc',
  },
  layout: {
    forumPostLayout: 'sidebar',
    forumChannelList: 'table',
    maxWidth: 960,
  },
};

export const PUBLIC_THEMES: PublicTheme[] = [modernTheme, classicForumTheme];
export const DEFAULT_THEME_ID = 'modern';

export function getPublicTheme(id: string | null | undefined): PublicTheme {
  if (!id) return modernTheme;
  return PUBLIC_THEMES.find((t) => t.id === id) || modernTheme;
}
