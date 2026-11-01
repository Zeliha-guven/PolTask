// Ekranların ortak yükleniyor / hata / boş görünümleri. Hata metni bildirimle gösterilir; burada yalnız eylem var.
import { Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export function Loading() {
  return (
    <Center py="xl" role="status" aria-label="Yükleniyor">
      <Loader />
    </Center>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <Title order={3}>Veriler yüklenemedi</Title>
        <Text c="dimmed">Sunucu çalışıyor mu? Ayrıntı bildirimde.</Text>
        <Button onClick={onRetry}>Tekrar dene</Button>
      </Stack>
    </Center>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <Title order={3}>{title}</Title>
        {text && <Text c="dimmed">{text}</Text>}
        {action}
      </Stack>
    </Center>
  );
}
