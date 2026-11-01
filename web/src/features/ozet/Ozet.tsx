// Özet: KPI kutuları, satır/kolon seçilebilen pivot (hücre → filtreli Liste), yaklaşan tarihler.
import { Badge, Card, Grid, Group, NativeSelect, SimpleGrid, Stack, Table, Text, Title, UnstyledButton } from '@mantine/core';
import { Fragment, useState } from 'react';
import type { Task } from '../../api/types';
import { useAppData } from '../../components/AppData';
import { useNav } from '../../components/Nav';
import { StatusBadge } from '../../components/StatusBadge';
import { fmtDateShort, inWeekOf, today } from '../../lib/dates';
import { EMPTY_FILTERS, FILTER_KEYS, type Filters, type SpecialFilter } from '../../lib/filtering';
import { loadPref, savePref } from '../../lib/prefs';
import { dimLabel, dimValue, isClosed, isLate, opmSuggestion, sortValues, str, targetDate, taskTitle, valueOptions } from '../../lib/rules';

export function Ozet() {
  const { meta, tasks, roles, generic, fields, setFilters } = useAppData();
  const { go, openTask } = useNav();
  const dims = FILTER_KEYS.filter((k) => fields.has(k));
  const [rowK, setRowK] = useState(() => loadPref('pivotRow'));
  const [colK, setColK] = useState(() => loadPref('pivotCol'));
  if (!meta) return null;
  const now = today();
  // Belgelenmiş varsayılan: satır Kapsam Tipi × kolon Durum (meta'da varsa); geçersiz kayıtlı değer yok sayılır.
  const fallback = (preferred: string, other: number) => (dims.includes(preferred) ? preferred : (dims[other] ?? preferred));
  const row = rowK && dims.includes(rowK) ? rowK : fallback('kapsam_tipi', 0);
  const col = colK && dims.includes(colK) ? colK : fallback('durum', 1);

  const open = tasks.filter((t) => !isClosed(t, roles));
  const kpis: { key: SpecialFilter | 'linktera'; value: number; label: string }[] = [
    { key: 'acik', value: open.length, label: 'Açık iş' },
    { key: 'linktera', value: open.filter((t) => str(t, 'kimde_bekliyor') === 'Linktera').length, label: "Linktera'da bekleyen" },
    { key: 'gecikmis', value: tasks.filter((t) => isLate(t, roles, now)).length, label: 'Hedef tarihi geçmiş' },
    { key: 'uat_hafta', value: tasks.filter((t) => inWeekOf(str(t, 'uat_hedef'), now)).length, label: 'Bu hafta UAT' },
    { key: 'opm_uyumsuz', value: tasks.filter((t) => opmSuggestion(t, roles)).length, label: "OPM'de kapanmış, bizde açık" },
  ];

  const toList = (f: Filters) => {
    setFilters(f);
    go('liste');
  };

  // Pivot
  const rowsMap = new Map<string, Map<string, number>>();
  const colSet = new Set<string>();
  for (const t of tasks) {
    const r = dimValue(t, row);
    const c = dimValue(t, col);
    colSet.add(c);
    const m = rowsMap.get(r) ?? new Map<string, number>();
    m.set(c, (m.get(c) ?? 0) + 1);
    rowsMap.set(r, m);
  }
  const rowKeys = sortValues(rowsMap.keys(), valueOptions(meta, row));
  const colKeys = sortValues(colSet, valueOptions(meta, col));
  const colTotal = (c: string) => rowKeys.reduce((s, r) => s + (rowsMap.get(r)?.get(c) ?? 0), 0);
  const dimOptions = dims.map((k) => ({ value: k, label: fields.get(k)?.etiket ?? k }));

  // Yaklaşan tarihler
  const upcoming: { kind: string; date: string; task: Task }[] = [];
  for (const t of open) {
    const h = targetDate(t);
    if (h) upcoming.push({ kind: 'Teslim', date: h, task: t });
    const u = str(t, 'uat_hedef');
    if (u) upcoming.push({ kind: 'UAT', date: u, task: t });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  const past = upcoming.filter((u) => u.date < now).slice(-5);
  const next = upcoming.filter((u) => u.date >= now).slice(0, 10);

  const cell = (n: number | undefined, f: Filters, label: string) =>
    n ? (
      <Table.Td>
        <UnstyledButton aria-label={label} onClick={() => toList(f)} fw={600}>
          {n}
        </UnstyledButton>
      </Table.Td>
    ) : (
      <Table.Td c="dimmed">·</Table.Td>
    );

  const upItem = (u: { kind: string; date: string; task: Task }) => (
    <UnstyledButton
      key={`${u.kind}-${u.task.id}`}
      onClick={() => openTask(u.task.id)}
      w="100%"
      p={4}
    >
      <Group gap="sm" wrap="nowrap">
        <Text size="sm" w={48} className={u.date < now ? 'pt-late' : undefined}>
          {fmtDateShort(u.date)}
        </Text>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>
            {taskTitle(u.task, generic)}
          </Text>
          <Text size="xs" c="dimmed" component="div">
            <Badge size="xs" variant="outline" mr={4}>
              {u.kind}
            </Badge>
            {str(u.task, 'kimde_bekliyor') ?? ''} {str(u.task, 'opm_no') ? `· ${str(u.task, 'opm_no')}` : ''}
          </Text>
        </Stack>
        <StatusBadge durum={str(u.task, 'durum')} />
      </Group>
    </UnstyledButton>
  );

  return (
    <Stack>
      <SimpleGrid cols={5}>
        {kpis.map((k) => (
          <Card
            key={k.key}
            withBorder
            component="button"
            className="pt-clickable"
            style={{ textAlign: 'left' }}
            onClick={() =>
              toList(
                k.key === 'linktera'
                  ? { ...EMPTY_FILTERS, special: ['acik'], fields: { kimde_bekliyor: 'Linktera' } }
                  : { ...EMPTY_FILTERS, special: [k.key] },
              )
            }
          >
            <Text size="xl" fw={700} data-testid={`kpi-${k.key}`}>
              {k.value}
            </Text>
            <Text size="sm" c="dimmed">
              {k.label}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
      <Grid>
        <Grid.Col span={8}>
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={2} size="h4">
                Güncel Durum
              </Title>
              <Group gap="xs">
                <NativeSelect
                  size="xs"
                  label="Satır"
                  value={row}
                  data={dimOptions}
                  onChange={(e) => {
                    setRowK(e.currentTarget.value);
                    savePref('pivotRow', e.currentTarget.value);
                  }}
                />
                <NativeSelect
                  size="xs"
                  label="Kolon"
                  value={col}
                  data={dimOptions}
                  onChange={(e) => {
                    setColK(e.currentTarget.value);
                    savePref('pivotCol', e.currentTarget.value);
                  }}
                />
              </Group>
            </Group>
            <Table.ScrollContainer minWidth={500}>
              <Table striped highlightOnHover withTableBorder verticalSpacing={4} className="pt-table" aria-label="Pivot">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{fields.get(row)?.etiket ?? row}</Table.Th>
                    {colKeys.map((c) => (
                      <Table.Th key={c}>{dimLabel(c)}</Table.Th>
                    ))}
                    <Table.Th>Genel Toplam</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rowKeys.map((r) => {
                    const m = rowsMap.get(r);
                    const tot = [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);
                    return (
                      <Table.Tr key={r}>
                        <Table.Td>{dimLabel(r)}</Table.Td>
                        {colKeys.map((c) => (
                          <Fragment key={c}>{cell(m?.get(c), { ...EMPTY_FILTERS, fields: { [row]: r, [col]: c } }, `${dimLabel(r)} / ${dimLabel(c)}`)}</Fragment>
                        ))}
                        {cell(tot, { ...EMPTY_FILTERS, fields: { [row]: r } }, `${dimLabel(r)} toplam`)}
                      </Table.Tr>
                    );
                  })}
                  <Table.Tr fw={700}>
                    <Table.Td>Genel Toplam</Table.Td>
                    {colKeys.map((c) => (
                      <Fragment key={c}>{cell(colTotal(c), { ...EMPTY_FILTERS, fields: { [col]: c } }, `${dimLabel(c)} toplam`)}</Fragment>
                    ))}
                    {cell(tasks.length, EMPTY_FILTERS, 'Genel toplam')}
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Grid.Col>
        <Grid.Col span={4}>
          <Card withBorder>
            <Title order={2} size="h4" mb="sm">
              Yaklaşan tarihler
            </Title>
            {past.length > 0 && (
              <>
                <Text size="xs" c="dimmed">
                  Geçmiş (son 5)
                </Text>
                {past.map(upItem)}
              </>
            )}
            <Text size="xs" c="dimmed" mt="xs">
              Önümüzdeki
            </Text>
            {next.length ? next.map(upItem) : <Text size="sm" c="dimmed">Tarihli açık iş yok</Text>}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
