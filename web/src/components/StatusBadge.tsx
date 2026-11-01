import { Badge, Text } from '@mantine/core';
import { statusColor } from '../lib/rules';
import { useAppData } from './AppData';

/** Rozet her zaman tam durum adını gösterir (dar alanda kısalmaz). */
export function StatusBadge({ durum }: { durum: string | null }) {
  const { meta } = useAppData();
  if (!durum) return <Text c="dimmed" span>—</Text>;
  return (
    <Badge
      color={statusColor(meta, durum)}
      variant="light"
      radius="sm"
      style={{ flexShrink: 0, maxWidth: 'none', overflow: 'visible' }}
      styles={{ label: { overflow: 'visible', textOverflow: 'clip' } }}
    >
      {durum}
    </Badge>
  );
}
