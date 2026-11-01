// Liste: Ana Başlık'a göre gruplu tablo, filtreler, arama, kolon seçici, sıralama, satır içi durum değişikliği.
import { Badge, Box, Button, Card, Checkbox, Group, NativeSelect, Popover, Stack, Table, Text } from '@mantine/core';
import { Fragment, useState } from 'react';
import type { Task } from '../../api/types';
import { useAppData } from '../../components/AppData';
import { FilterBar } from '../../components/FilterBar';
import { useNav } from '../../components/Nav';
import { TaskFlags } from '../../components/TaskFlags';
import { useSetDurum } from '../../components/useSetDurum';
import { fmtDate, today } from '../../lib/dates';
import { applyFilters } from '../../lib/filtering';
import { loadPref, savePref } from '../../lib/prefs';
import { isLate, num, str, targetDate, taskSubtitle, taskTitle, trCompare } from '../../lib/rules';

/** Seçilebilir kolonlar (etiket/tip meta'dan); "hedef_tarih" BR-1 hedef tarihini gösterir. */
const LIST_COLS = [
  'konu', 'kapsam_tipi', 'durum', 'yuzde', 'kimde_bekliyor', 'oncelik', 'opm_no', 'hedef_tarih',
  'ilk_hedef_tarih', 'uat_hedef', 'opm_talep_tarihi', 'bitis_tarihi', 'yayginlastirma_tarihi',
  'talep_sorumlusu', 'linktera_sorumlusu', 'sozlesme', 'ltr_yorum', 'cr_no',
];
const DEFAULT_COLS = ['konu', 'kapsam_tipi', 'durum', 'yuzde', 'kimde_bekliyor', 'oncelik', 'opm_no', 'hedef_tarih', 'talep_sorumlusu'];

/** Kayıtlı kolon seçimi; geçersizse (JSON değil, dizi değil, bilinen kolon yok) belgelenmiş varsayılan. */
function loadCols(): string[] {
  try {
    const raw = loadPref('cols');
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(v)) return DEFAULT_COLS;
    const cols = v.filter((x): x is string => typeof x === 'string' && LIST_COLS.includes(x));
    return cols.length ? cols : DEFAULT_COLS;
  } catch {
    return DEFAULT_COLS;
  }
}
function saveCols(cols: string[]) {
  savePref('cols', JSON.stringify(cols));
}

type Sort = { key: string | null; dir: 1 | -1 };

export function Liste() {
  const { meta, tasks, roles, generic, fields, filters } = useAppData();
  const { openTask } = useNav();
  const setDurum = useSetDurum();
  const [cols, setCols] = useState<string[]>(loadCols);
  const [sort, setSort] = useState<Sort>({ key: null, dir: 1 });
  if (!meta) return null;
  const now = today();

  const available = LIST_COLS.filter((c) => fields.has(c));
  const shownCols = available.filter((c) => c === 'konu' || cols.includes(c));
  const label = (c: string) => (c === 'hedef_tarih' ? 'Hedef Teslim' : (fields.get(c)?.etiket ?? c));

  let list = applyFilters(tasks, filters, roles, now);
  if (sort.key) {
    const k = sort.key;
    const get = (t: Task): string | number | null =>
      k === 'hedef_tarih' ? targetDate(t) : fields.get(k)?.tip === 'int' ? num(t, k) : str(t, k);
    list = [...list].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : trCompare(String(x), String(y))) * sort.dir;
    });
  }
  const groups = new Map<string, Task[]>();
  for (const t of list) {
    const g = str(t, 'ana_baslik') ?? '(Ana başlık yok)';
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }

  const toggleSort = (k: string) =>
    setSort((s) => (s.key !== k ? { key: k, dir: 1 } : s.dir === 1 ? { key: k, dir: -1 } : { key: null, dir: 1 }));

  const renderCell = (t: Task, c: string) => {
    switch (c) {
      case 'konu': {
        const sub = taskSubtitle(t, generic);
        const konu = str(t, 'konu');
        return (
          <Table.Td key={c} className="wrap">
            {konu && generic.has(konu) && (
              <Badge size="xs" variant="outline" mr={4}>
                {konu}
              </Badge>
            )}
            <Text size="sm" fw={600} className="pt-clamp">
              {taskTitle(t, generic)}
            </Text>
            {sub && (
              <Text size="xs" c="dimmed" className="pt-clamp">
                {sub}
              </Text>
            )}
            {!!t.yorum_sayisi && (
              <Text size="xs" c="dimmed">
                💬 {t.yorum_sayisi}
              </Text>
            )}
          </Table.Td>
        );
      }
      case 'durum':
        return (
          <Table.Td key={c} onClick={(e) => e.stopPropagation()}>
            <Group gap={4} wrap="nowrap">
              <NativeSelect
                size="xs"
                aria-label={`Durum: ${taskTitle(t, generic)}`}
                value={str(t, 'durum') ?? ''}
                data={str(t, 'durum') ? meta.durumlar : ['', ...meta.durumlar]}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  if (v) void setDurum(t.id, v);
                }}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <TaskFlags task={t} />
            </Group>
          </Table.Td>
        );
      case 'yuzde':
        return <Table.Td key={c}>{num(t, c) === null ? '' : `${num(t, c)}%`}</Table.Td>;
      case 'oncelik':
        return <Table.Td key={c}>{num(t, c) ? <Badge size="sm" variant="light">P{num(t, c)}</Badge> : ''}</Table.Td>;
      case 'hedef_tarih': {
        const d = targetDate(t);
        return (
          <Table.Td key={c} className={isLate(t, roles, now) ? 'pt-late' : undefined}>
            {fmtDate(d)}
            {!str(t, 'hedef_tarih') && d && (
              <Text span size="xs" c="dimmed" title="İlk verilen hedef">
                {' '}
                (ilk)
              </Text>
            )}
          </Table.Td>
        );
      }
      case 'ltr_yorum':
        return (
          <Table.Td key={c} className="wrap">
            <Text size="xs" className="pt-clamp">
              {str(t, c)}
            </Text>
          </Table.Td>
        );
      default:
        return <Table.Td key={c}>{fields.get(c)?.tip === 'date' ? fmtDate(str(t, c)) : (str(t, c) ?? '')}</Table.Td>;
    }
  };

  return (
    <Stack gap="xs">
      <Group align="flex-start" wrap="nowrap">
        <Box style={{ flex: 1 }}>
          <FilterBar shown={list.length} />
        </Box>
        <Popover position="bottom-end" shadow="md">
          <Popover.Target>
            <Button size="xs" variant="default">
              Kolonlar ▾
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap={4}>
              {available.map((c) => (
                <Checkbox
                  key={c}
                  size="xs"
                  label={label(c)}
                  disabled={c === 'konu'}
                  checked={shownCols.includes(c)}
                  onChange={(e) => {
                    const on = e.currentTarget.checked;
                    const next = available.filter((k) => k === 'konu' || (k === c ? on : shownCols.includes(k)));
                    setCols(next);
                    saveCols(next);
                  }}
                />
              ))}
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() => {
                  setCols(DEFAULT_COLS);
                  saveCols(DEFAULT_COLS);
                }}
              >
                Varsayılana dön
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
      <Card withBorder p={0}>
        <Table.ScrollContainer minWidth={900}>
          <Table highlightOnHover verticalSpacing={4} className="pt-table" aria-label="İş listesi">
            <Table.Thead>
              <Table.Tr>
                {shownCols.map((c) => (
                  <Table.Th
                    key={c}
                    aria-sort={sort.key === c ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  >
                    <Button size="compact-xs" variant="transparent" color="gray" onClick={() => toggleSort(c)}>
                      {label(c)}
                      {sort.key === c ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                    </Button>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groups.size === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={shownCols.length}>
                    <Text c="dimmed" ta="center" py="lg">
                      Filtreye uyan iş yok
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {[...groups].map(([g, ts]) => (
                <Fragment key={g}>
                  <Table.Tr bg="var(--mantine-color-default-hover)">
                    <Table.Td colSpan={shownCols.length} fw={700}>
                      {g}{' '}
                      <Text span c="dimmed" size="sm">
                        · {ts.length}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  {ts.map((t) => (
                    <Table.Tr
                      key={t.id}
                      className="pt-clickable"
                      tabIndex={0}
                      data-testid={`task-row-${t.id}`}
                      onClick={() => openTask(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openTask(t.id);
                      }}
                    >
                      {shownCols.map((c) => renderCell(t, c))}
                    </Table.Tr>
                  ))}
                </Fragment>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
