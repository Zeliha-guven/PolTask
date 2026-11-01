// Tema: açık · koyu · sistem. Seçim Mantine'in localStorage yöneticisiyle hatırlanır (AC-6).
import { SegmentedControl, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';

export function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <SegmentedControl
      fullWidth
      size="xs"
      aria-label="Tema"
      value={colorScheme}
      onChange={(v) => setColorScheme(v as MantineColorScheme)}
      data={[
        { value: 'light', label: 'Açık' },
        { value: 'dark', label: 'Koyu' },
        { value: 'auto', label: 'Sistem' },
      ]}
    />
  );
}
