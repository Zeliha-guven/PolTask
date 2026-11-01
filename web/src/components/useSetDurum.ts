// Durum değişikliği (Liste satır içi, Pano sürükle-bırak). BR-2: tamamlandı rolüne geçişte %100 + bitiş önerilir.
import { useCallback } from 'react';
import { api } from '../api/client';
import type { TaskInput } from '../api/types';
import { today } from '../lib/dates';
import { num, str } from '../lib/rules';
import { useAppData } from './AppData';
import { useConfirm } from './Confirm';
import { notifySuccess } from './notify';

export function useSetDurum() {
  const { tasks, roles, upsertTask } = useAppData();
  const confirm = useConfirm();

  return useCallback(
    async (id: number, durum: string) => {
      const t = tasks.find((x) => x.id === id);
      // Boş seçim durum değişikliği değildir (Durum boşaltılamaz, CB-2)
      if (!durum || !t || str(t, 'durum') === durum) return;
      const patch: TaskInput = { durum };
      if (durum === roles.done && (num(t, 'yuzde') !== 100 || !str(t, 'bitis_tarihi'))) {
        const ok = await confirm(
          `${durum} olarak işaretleniyor.\nTamamlanma % 100 ve Bitiş Tarihi bugün olarak ayarlansın mı?`,
          { confirmLabel: 'Evet, ayarla' },
        );
        if (ok) {
          patch.yuzde = 100;
          if (!str(t, 'bitis_tarihi')) patch.bitis_tarihi = today();
        }
      }
      try {
        upsertTask(await api.patchTask(id, patch));
        notifySuccess(`Durum: ${durum}`);
      } catch {
        /* hata bildirimi client'ta */
      }
    },
    [tasks, roles, upsertTask, confirm],
  );
}
