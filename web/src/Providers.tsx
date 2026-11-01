import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import type { ReactNode } from 'react';
import { setApiErrorHandler } from './api/client';
import { AppDataProvider } from './components/AppData';
import { ConfirmProvider } from './components/Confirm';
import { notifyError } from './components/notify';
import { colorSchemeManager, theme } from './theme';

dayjs.locale('tr');
setApiErrorHandler(notifyError);

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} colorSchemeManager={colorSchemeManager} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: 'tr', firstDayOfWeek: 1 }}>
        <Notifications position="top-right" />
        <ConfirmProvider>
          <AppDataProvider>{children}</AppDataProvider>
        </ConfirmProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
