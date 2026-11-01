// Tek bildirim noktası (docs/conventions.md, Error handling): tüm hata ve başarı mesajları buradan.
import { notifications } from '@mantine/notifications';

export function notifyError(message: string): void {
  notifications.show({ color: 'red', title: 'Hata', message, autoClose: 5000 });
}

export function notifySuccess(message: string): void {
  notifications.show({ color: 'teal', message, autoClose: 2600 });
}
