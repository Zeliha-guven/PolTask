// BR-1 (gecikmiş) ve BR-3 (OPM'de kapanmış) işaretleri.
import { Badge, Tooltip } from '@mantine/core';
import type { Opm, Task } from '../api/types';
import { today } from '../lib/dates';
import { isLate, opmSuggestion } from '../lib/rules';
import { useAppData } from './AppData';

export function TaskFlags({ task }: { task: Task }) {
  const { roles } = useAppData();
  const late = isLate(task, roles, today());
  const suggestion = opmSuggestion(task, roles);
  const opm = task.opm as Opm | null | undefined;
  return (
    <>
      {late && (
        <Badge color="red" variant="filled" size="xs" radius="sm">
          Gecikmiş
        </Badge>
      )}
      {suggestion && opm && (
        <Tooltip label={`OPM durumu: ${opm.durum ?? ''} → önerilen: ${suggestion}`}>
          <Badge color="orange" variant="light" size="xs" radius="sm">
            OPM: {opm.durum}
          </Badge>
        </Tooltip>
      )}
    </>
  );
}
