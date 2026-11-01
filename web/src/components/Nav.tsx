import { createContext, useContext } from 'react';
import type { View } from '../lib/route';

export interface Nav {
  view: View;
  go: (view: View) => void;
  openTask: (id: number | 'new') => void;
}

export const NavContext = createContext<Nav>({ view: 'ozet', go: () => {}, openTask: () => {} });

export function useNav(): Nav {
  return useContext(NavContext);
}
