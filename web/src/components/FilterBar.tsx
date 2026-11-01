import { Button, Checkbox, Group, NativeSelect, Text } from '@mantine/core';
import type { Task } from '../api/types';
import { FILTER_KEYS, hasAnyFilter, SPECIAL_LABELS, EMPTY_FILTERS, type SpecialFilter } from '../lib/filtering';
import { dimLabel, dimValue, sortValues, valueOptions } from '../lib/rules';
import { useAppData } from './AppData';

export function distinctValues(tasks: Task[], key: string, order: string[] | null): string[] {
  return sortValues(new Set(tasks.map((t) => dimValue(t, key))), order);
}

export function FilterBar({ shown }: { shown: number }) {
  const { meta, tasks, fields, filters, setFilters } = useAppData();
  if (!meta) return null;
  const keys = FILTER_KEYS.filter((k) => fields.has(k));

  return (
    <Group gap="xs" wrap="wrap" mb="sm" align="center">
      {keys.map((k) => {
        const label = fields.get(k)?.etiket ?? k;
        const cur = filters.fields[k] ?? '';
        const values = distinctValues(tasks, k, valueOptions(meta, k));
        return (
          <NativeSelect
            key={k}
            size="xs"
            aria-label={label}
            value={cur}
            variant={cur ? 'filled' : 'default'}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFilters((f) => {
                const next = { ...f.fields };
                if (v) next[k] = v;
                else delete next[k];
                return { ...f, fields: next };
              });
            }}
            data={[{ value: '', label: `${label}: Tümü` }, ...values.map((v) => ({ value: v, label: dimLabel(v) }))]}
          />
        );
      })}
      {(Object.keys(SPECIAL_LABELS) as SpecialFilter[]).map((s) => (
        <Checkbox
          key={s}
          size="xs"
          label={SPECIAL_LABELS[s]}
          checked={filters.special.includes(s)}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setFilters((f) => ({ ...f, special: on ? [...f.special, s] : f.special.filter((x) => x !== s) }));
          }}
        />
      ))}
      {hasAnyFilter(filters) && (
        <Button size="compact-xs" variant="subtle" onClick={() => setFilters(EMPTY_FILTERS)}>
          ✕ Filtreleri temizle
        </Button>
      )}
      <Text size="xs" c="dimmed" ml="auto">
        {shown} / {tasks.length} iş
      </Text>
    </Group>
  );
}
