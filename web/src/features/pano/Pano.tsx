// Pano: durum kolonlarında sürükle-bırak (yerel HTML5 DnD), iptal kolonu katlanır, kolon başına sınır + "daha fazla".
import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useRef, useState, type DragEvent } from 'react';
import type { Task } from '../../api/types';
import { useAppData } from '../../components/AppData';
import { FilterBar } from '../../components/FilterBar';
import { useNav } from '../../components/Nav';
import { StatusBadge } from '../../components/StatusBadge';
import { TaskFlags } from '../../components/TaskFlags';
import { useSetDurum } from '../../components/useSetDurum';
import { fmtDate, today } from '../../lib/dates';
import { applyFilters } from '../../lib/filtering';
import { isLate, num, str, targetDate, taskSubtitle, taskTitle } from '../../lib/rules';

export const BOARD_LIMIT = 40;

export function Pano() {
  const { meta, tasks, roles, generic, filters } = useAppData();
  const { openTask } = useNav();
  const setDurum = useSetDurum();
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const dragged = useRef<number | null>(null);
  if (!meta) return null;
  const now = today();

  const list = applyFilters(tasks, filters, roles, now);
  const by = new Map<string, Task[]>(meta.durumlar.map((d) => [d, []]));
  for (const t of list) {
    const d = str(t, 'durum') ?? '';
    if (!by.has(d)) by.set(d, []);
    by.get(d)?.push(t);
  }
  for (const items of by.values())
    items.sort(
      (a, b) =>
        (num(a, 'oncelik') ?? 9) - (num(b, 'oncelik') ?? 9) ||
        (targetDate(a) ?? '9').localeCompare(targetDate(b) ?? '9'),
    );

  const drop = (durum: string, e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    const raw = e.dataTransfer?.getData('text/plain');
    const id = raw ? Number(raw) : dragged.current;
    dragged.current = null;
    if (id) void setDurum(id, durum);
  };

  const card = (t: Task) => {
    const d = targetDate(t);
    const opmNo = str(t, 'opm_no');
    const yuzde = num(t, 'yuzde');
    return (
      <Card
        key={t.id}
        withBorder
        padding="xs"
        className="pt-card pt-clickable"
        draggable
        tabIndex={0}
        role="button"
        aria-label={taskTitle(t, generic)}
        data-testid={`card-${t.id}`}
        onDragStart={(e) => {
          dragged.current = t.id;
          e.dataTransfer?.setData('text/plain', String(t.id));
        }}
        onClick={() => openTask(t.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTask(t.id);
          }
        }}
      >
        <Group gap={4} mb={4}>
          {str(t, 'kapsam_tipi') && (
            <Badge size="xs" variant="outline">
              {str(t, 'kapsam_tipi')}
            </Badge>
          )}
          {num(t, 'oncelik') !== null && (
            <Badge size="xs" variant="light">
              P{num(t, 'oncelik')}
            </Badge>
          )}
          <TaskFlags task={t} />
        </Group>
        <Text size="sm" fw={600} className="pt-clamp">
          {taskTitle(t, generic)}
        </Text>
        {taskSubtitle(t, generic) && (
          <Text size="xs" c="dimmed" className="pt-clamp">
            {taskSubtitle(t, generic)}
          </Text>
        )}
        <Group gap={8} mt={4}>
          {opmNo && /LTR/i.test(opmNo) && <Text size="xs">{opmNo}</Text>}
          {d && (
            <Text size="xs" className={isLate(t, roles, now) ? 'pt-late' : undefined}>
              ⏱ {fmtDate(d)}
            </Text>
          )}
          {str(t, 'kimde_bekliyor') && <Text size="xs">→ {str(t, 'kimde_bekliyor')}</Text>}
          {yuzde !== null && yuzde > 0 && yuzde < 100 && <Text size="xs">{yuzde}%</Text>}
          {!!t.yorum_sayisi && <Text size="xs">💬 {t.yorum_sayisi}</Text>}
        </Group>
      </Card>
    );
  };

  return (
    <Stack gap="xs">
      <FilterBar shown={list.length} />
      <div className="pt-board">
        {[...by].map(([durum, items]) => {
          const collapsed = durum === roles.cancelled && !cancelledOpen;
          const shown = showAll[durum] ? items : items.slice(0, BOARD_LIMIT);
          return (
            <section
              key={durum}
              aria-label={`Kolon: ${durum}`}
              data-testid={`col-${durum}`}
              className={`pt-col${collapsed ? ' collapsed' : ''}${over === durum ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(durum);
              }}
              onDragLeave={() => setOver((o) => (o === durum ? null : o))}
              onDrop={(e) => drop(durum, e)}
            >
              <Group justify="space-between" mb="xs" wrap="nowrap">
                <StatusBadge durum={durum} />
                <Text size="xs" c="dimmed">
                  {items.length}
                </Text>
              </Group>
              {collapsed ? (
                <Button size="compact-xs" variant="subtle" onClick={() => setCancelledOpen(true)}>
                  Göster
                </Button>
              ) : (
                <Stack gap={6}>
                  {shown.map(card)}
                  {items.length > shown.length && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => setShowAll((s) => ({ ...s, [durum]: true }))}
                    >
                      + {items.length - shown.length} iş daha göster
                    </Button>
                  )}
                </Stack>
              )}
            </section>
          );
        })}
      </div>
    </Stack>
  );
}
