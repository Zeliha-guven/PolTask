import { createTheme, localStorageColorSchemeManager, type MantineColorsTuple } from '@mantine/core';

// Teal ana renk; 7. ton = #0f766e (beyaz metinle WCAG AA).
const brand: MantineColorsTuple = [
  '#f0fdfa',
  '#ccfbf1',
  '#99f6e4',
  '#5eead4',
  '#2dd4bf',
  '#14b8a6',
  '#0d9488',
  '#0f766e',
  '#115e59',
  '#134e4a',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 7,
  colors: { brand },
  defaultRadius: 'md',
  respectReducedMotion: true,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
});

export const COLOR_SCHEME_KEY = 'poltask.web.renkSemasi';
export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_KEY });
