import { createContext, useContext } from 'react';
import { getPublicTheme, type PublicTheme } from '../lib/publicThemes.js';

const PublicThemeContext = createContext<PublicTheme>(getPublicTheme(null));

export const PublicThemeProvider = PublicThemeContext.Provider;

export function usePublicTheme(): PublicTheme {
  return useContext(PublicThemeContext);
}
