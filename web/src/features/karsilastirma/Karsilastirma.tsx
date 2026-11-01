// Karşılaştırma: iki snapshot (veya canlı) farkı, haftalık açık iş grafiği, snapshot al/sil.
// Ekran açılınca haftalık snapshot isteği gönderilir (POST /api/snapshots/haftalik, CB-6).
import { BarChart } from '@mantine/charts';
import { ActionIcon, Button, Card, Grid, Group, NativeSelect, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { Pivot, Snapshot } from '../../api/types';
import { useAppData } from '../../components/AppData';
import { useConfirm } from '../../components/Confirm';
import { EmptyState, LoadError, Loading } from '../../components/LoadState';
import { notifySuccess } from '../../components/notify';
import { fmtDate, fmtDateShort, today } from '../../lib/dates';
import { str, statusColor, trCompare } from '../../lib/rules';

const BLANK = '(boş)';
const sum = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

function Delta({ now, before }: { now: number; before: number }) {
  const n = now - before;
  if (!n) return null;
  return <span className={n > 0 ? 'pt-delta-up' : 'pt-delta-down'}>{n > 0 ? `+${n}` : n}</span>;
}

export function Karsilastirma() {
  const { meta, tasks, roles, fields } = useAppData();
  const confirm = useConfirm();
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string>('live');
  const [label, setLabel] = useState('');

  const load = useCallback(async (weekly: boolean) => {
    setFailed(false);
    try {
      if (weekly) {
        try {
          await api.weeklySnapshot();
        } catch {
          /* bildirim gösterildi; liste yine de yüklenir */
        }
      }
      setSnaps(await api.snapshots());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const live = useMemo<Pivot>(() => {
    const p: Pivot = {};
    for (const t of tasks) {
      const k = str(t, 'kapsam_tipi') ?? BLANK;
      const d = str(t, 'durum') ?? BLANK;
      const row = (p[k] ??= {});
      row[d] = (row[d] ?? 0) + 1;
    }
    return p;
  }, [tasks]);

  if (failed) return <LoadError onRetry={() => void load(false)} />;
  if (!snaps || !meta) return <Loading />;

  const now = today();
  const options = [
    ...snaps.map((s) => ({ value: String(s.id), label: `${fmtDate(s.tarih.slice(0, 10))} — ${s.etiket ?? ''}`, pivot: s.pivot })),
    { value: 'live', label: 'Şu an (canlı)', pivot: live },
  ];
  const byId = new Map(options.map((o) => [o.value, o]));
  const lastHistoric = [...snaps].reverse().find((s) => s.tarih.slice(0, 10) < now) ?? snaps[snaps.length - 1];
  const aId = a && byId.has(a) ? a : lastHistoric ? String(lastHistoric.id) : 'live';
  const bId = byId.has(b) ? b : 'live';
  const A = byId.get(aId)?.pivot ?? {};
  const B = byId.get(bId)?.pivot ?? {};

  const kapsamlar = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort((x, y) =>
    x === BLANK ? 1 : y === BLANK ? -1 : trCompare(x, y),
  );
  const extra = [...new Set(kapsamlar.flatMap((k) => [...Object.keys(A[k] ?? {}), ...Object.keys(B[k] ?? {})]))].filter(
    (d) => !meta.durumlar.includes(d),
  );
  const durumlar = [...meta.durumlar, ...extra].filter((d) => kapsamlar.some((k) => A[k]?.[d] || B[k]?.[d]));
  const colSum = (P: Pivot, d: string) => kapsamlar.reduce((s, k) => s + (P[k]?.[d] ?? 0), 0);
  const total = (P: Pivot) => kapsamlar.reduce((s, k) => s + sum(P[k]), 0);
  const cell = (nowV: number, before: number, key: string) => (
    <Table.Td key={key}>
      {nowV || (before ? 0 : <Text span c="dimmed">·</Text>)}
      <Delta now={nowV} before={before} />
    </Table.Td>
  );

  // Haftalık grafik: gün başına son snapshot, açık durumlar
  const byDay = new Map<string, Snapshot>();
  for (const s of snaps) byDay.set(s.tarih.slice(0, 10), s);
  const openStatuses = meta.durumlar.filter((d) => !roles.closed.has(d));
  const chartData = [...byDay.values()].map((s) => {
    const row: Record<string, string | number> = { tarih: fmtDateShort(s.tarih.slice(0, 10)) };
    for (const d of openStatuses) row[d] = Object.values(s.pivot).reduce((acc, r) => acc + (r[d] ?? 0), 0);
    return row;
  });

  const take = async () => {
    try {
      await api.createSnapshot(label.trim());
      setLabel('');
      notifySuccess('Anlık görüntü alındı');
      await load(false);
    } catch {
      /* bildirim gösterildi */
    }
  };
  const remove = async (s: Snapshot) => {
    if (!(await confirm('Bu anlık görüntü silinsin mi?', { confirmLabel: 'Sil', danger: true }))) return;
    try {
      await api.deleteSnapshot(s.id);
      notifySuccess('Anlık görüntü silindi');
      await load(false);
    } catch {
      /* bildirim gösterildi */
    }
  };

  return (
    <Stack>
      <Grid>
        <Grid.Col span={8}>
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={2} size="h4">
                Durum karşılaştırması
              </Title>
              <Group gap="xs">
                <NativeSelect size="xs" aria-label="Önceki" value={aId} data={options} onChange={(e) => setA(e.currentTarget.value)} />
                <Text c="dimmed">→</Text>
                <NativeSelect size="xs" aria-label="Sonraki" value={bId} data={options} onChange={(e) => setB(e.currentTarget.value)} />
              </Group>
            </Group>
            {kapsamlar.length === 0 ? (
              <Text c="dimmed">Karşılaştırılacak veri yok</Text>
            ) : (
              <Table withTableBorder striped verticalSpacing={4} className="pt-table" aria-label="Karşılaştırma">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{fields.get('kapsam_tipi')?.etiket ?? 'kapsam_tipi'}</Table.Th>
                    {durumlar.map((d) => (
                      <Table.Th key={d}>{d}</Table.Th>
                    ))}
                    <Table.Th>Genel Toplam</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {kapsamlar.map((k) => (
                    <Table.Tr key={k}>
                      <Table.Td>{k}</Table.Td>
                      {durumlar.map((d) => cell(B[k]?.[d] ?? 0, A[k]?.[d] ?? 0, d))}
                      {cell(sum(B[k]), sum(A[k]), '__toplam')}
                    </Table.Tr>
                  ))}
                  <Table.Tr fw={700}>
                    <Table.Td>Genel Toplam</Table.Td>
                    {durumlar.map((d) => cell(colSum(B, d), colSum(A, d), d))}
                    {cell(total(B), total(A), '__toplam')}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            )}
            <Text size="xs" c="dimmed" mt="xs">
              Hücrelerde sağdaki seçimin değeri, yanında soldakine göre fark gösterilir.
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={2} size="h4">
                Anlık görüntüler
              </Title>
              <Text size="sm" c="dimmed">
                {snaps.length} kayıt
              </Text>
            </Group>
            <Group gap="xs" mb="sm" wrap="nowrap">
              <TextInput
                aria-label="Etiket"
                placeholder="Etiket (ör. 23 Ekim haftası)"
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={() => void take()}>Anlık görüntü al</Button>
            </Group>
            {snaps.length === 0 ? (
              <Text size="sm" c="dimmed">
                Henüz anlık görüntü yok
              </Text>
            ) : (
              <Stack gap={4}>
                {[...snaps].reverse().map((s) => (
                  <Group key={s.id} gap="xs" wrap="nowrap">
                    <Text size="sm" c="dimmed" w={84}>
                      {fmtDate(s.tarih.slice(0, 10))}
                    </Text>
                    <Text size="sm" style={{ flex: 1 }} truncate>
                      {s.etiket ?? ''}
                    </Text>
                    <Text size="sm" fw={700}>
                      {Object.values(s.pivot).reduce((acc, r) => acc + sum(r), 0)}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Sil: ${fmtDate(s.tarih.slice(0, 10))} ${s.etiket ?? ''}`}
                      onClick={() => void remove(s)}
                    >
                      ✕
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>
      <Card withBorder>
        <Title order={2} size="h4" mb="xs">
          Haftalara göre durum dağılımı
        </Title>
        <Text size="xs" c="dimmed" mb="sm">
          Açık işler (kapanmış durumlar hariç) — haftalık değişim
        </Text>
        {chartData.length === 0 ? (
          <EmptyState title="Grafik için anlık görüntü yok" />
        ) : (
          <BarChart
            h={300}
            data={chartData}
            dataKey="tarih"
            type="stacked"
            withLegend
            series={openStatuses.map((d) => ({ name: d, color: `${statusColor(meta, d)}.6` }))}
          />
        )}
      </Card>
    </Stack>
  );
}
