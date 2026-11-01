// İş detayı çekmecesi: meta.alanlar'daki tüm alanlar, OPM kutusu + "Uygula", yorum ekle/sil, tarihçe; yeni iş.
import { ActionIcon, Badge, Box, Button, Card, Drawer, Group, NumberInput, Select, SimpleGrid, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Alan, Opm, Task, TaskInput, TimelineItem } from '../../api/types';
import { useAppData } from '../../components/AppData';
import { useConfirm } from '../../components/Confirm';
import { Loading } from '../../components/LoadState';
import { notifyError, notifySuccess } from '../../components/notify';
import { StatusBadge } from '../../components/StatusBadge';
import { fmtDate, fmtTs, today } from '../../lib/dates';
import { opmSuggestion, str, taskTitle, valueOptions } from '../../lib/rules';

/** Sunucunun düzenlemeye kapattığı alan (içe aktarımdan gelen tarihçe metni). */
const READ_ONLY = new Set(['icerik_tarihce']);

type Values = Record<string, string>;

function toValues(t: Task, alanlar: Alan[]): Values {
  return Object.fromEntries(alanlar.map((a) => [a.anahtar, str(t, a.anahtar) ?? '']));
}

export function TaskDrawer({
  taskId,
  onClose,
  onCreated,
}: {
  taskId: number | 'new';
  onClose: () => void;
  /** Yeni iş oluşturulunca çekmece o iş için yeniden açılır (eski arayüz davranışı). */
  onCreated: (id: number) => void;
}) {
  const { meta, tasks, roles, generic, filters, upsertTask, removeTask } = useAppData();
  const confirm = useConfirm();
  const isNew = taskId === 'new';
  const alanlar = (meta?.alanlar ?? []).filter((a) => !READ_ONLY.has(a.anahtar));
  const existing = isNew ? null : (tasks.find((t) => t.id === taskId) ?? null);

  const initial = useCallback((): Values => {
    if (existing) return toValues(existing, alanlar);
    const v: Values = Object.fromEntries(alanlar.map((a) => [a.anahtar, '']));
    v.durum = roles.initial;
    v.opm_talep_tarihi = today();
    v.sozlesme = meta?.sozlesme_degerleri[0] ?? '';
    const ab = filters.fields.ana_baslik;
    if (ab && ab !== '__bos__') v.ana_baslik = ab;
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const [base, setBase] = useState<Values>(initial);
  const [values, setValues] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[] | null>(null);
  const [comment, setComment] = useState('');

  const loadTimeline = useCallback(async () => {
    if (isNew) return;
    try {
      setTimeline(await api.timeline(taskId));
    } catch {
      setTimeline([]);
    }
  }, [isNew, taskId]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  if (!meta) return null;
  if (!isNew && !existing) {
    return (
      <Drawer opened onClose={onClose} position="right" size="xl" title="İş bulunamadı">
        <Text>Bu iş bulunamadı veya silinmiş.</Text>
      </Drawer>
    );
  }

  const changes = (): TaskInput => {
    const out: TaskInput = {};
    for (const a of alanlar) {
      const v = (values[a.anahtar] ?? '').trim();
      if (v !== (base[a.anahtar] ?? '')) out[a.anahtar] = v === '' ? null : v;
    }
    return out;
  };
  const dirty = Object.keys(changes()).length > 0;

  const close = async () => {
    if (dirty && !(await confirm('Kaydedilmemiş değişiklikler var. Kapatılsın mı?', { confirmLabel: 'Kapat' }))) return;
    onClose();
  };

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const ch = changes();
    if (isNew) {
      if (!(values.konu ?? '').trim()) {
        notifyError('Konu zorunlu');
        return;
      }
      const body: TaskInput = {};
      for (const a of alanlar) {
        const v = (values[a.anahtar] ?? '').trim();
        if (v) body[a.anahtar] = v;
      }
      setSaving(true);
      try {
        const t = await api.createTask(body);
        upsertTask(t);
        notifySuccess('İş oluşturuldu');
        onCreated(t.id);
      } catch {
        /* bildirim gösterildi */
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!existing) return;
    if (!Object.keys(ch).length) {
      notifySuccess('Değişiklik yok');
      return;
    }
    if ('konu' in ch && !ch.konu) {
      notifyError('Konu zorunlu');
      return;
    }
    if (ch.durum === roles.done && !ch.bitis_tarihi && !str(existing, 'bitis_tarihi')) {
      if (await confirm('Bitiş Tarihi bugün ve Tamamlanma % 100 olarak ayarlansın mı?', { confirmLabel: 'Evet, ayarla' })) {
        ch.bitis_tarihi = today();
        ch.yuzde = 100;
      }
    }
    setSaving(true);
    try {
      const t = await api.patchTask(existing.id, ch);
      upsertTask(t);
      const nv = toValues({ ...existing, ...t }, alanlar);
      setBase(nv);
      setValues(nv);
      notifySuccess('Kaydedildi');
      void loadTimeline();
    } catch {
      /* bildirim gösterildi */
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!existing) return;
    if (!(await confirm(`"${taskTitle(existing, generic)}" silinsin mi? Bu işlem geri alınamaz.`, { confirmLabel: 'Sil', danger: true })))
      return;
    try {
      await api.deleteTask(existing.id);
      removeTask(existing.id);
      notifySuccess('İş silindi');
      onClose();
    } catch {
      /* bildirim gösterildi */
    }
  };

  const addComment = async () => {
    if (!existing) return;
    const metin = comment.trim();
    if (!metin) return;
    try {
      await api.addComment(existing.id, metin);
      setComment('');
      upsertTask({ ...existing, yorum_sayisi: (existing.yorum_sayisi ?? 0) + 1 });
      notifySuccess('Yorum eklendi');
      void loadTimeline();
    } catch {
      /* bildirim gösterildi */
    }
  };

  const delComment = async (cid: number) => {
    if (!existing) return;
    if (!(await confirm('Yorum silinsin mi?', { confirmLabel: 'Sil', danger: true }))) return;
    try {
      await api.deleteComment(cid);
      upsertTask({ ...existing, yorum_sayisi: Math.max(0, (existing.yorum_sayisi ?? 1) - 1) });
      void loadTimeline();
    } catch {
      /* bildirim gösterildi */
    }
  };

  const field = (a: Alan) => {
    const v = values[a.anahtar] ?? '';
    const changed = v.trim() !== (base[a.anahtar] ?? '');
    const common = {
      label: a.etiket,
      description: changed ? 'değişti' : undefined,
    };
    const opts = valueOptions(meta, a.anahtar);
    if (opts) {
      const data = v && !opts.includes(v) ? [...opts, v] : opts;
      // Durum boşaltılamaz (CB-2): seçim temizlenemez
      return (
        <Select
          key={a.anahtar}
          {...common}
          data={data}
          value={v || null}
          clearable={a.anahtar !== 'durum'}
          allowDeselect={a.anahtar !== 'durum'}
          onChange={(x) => {
            if (a.anahtar === 'durum' && !x) return;
            set(a.anahtar, x ?? '');
          }}
        />
      );
    }
    switch (a.tip) {
      case 'textarea':
        return (
          <Textarea
            key={a.anahtar}
            {...common}
            autosize
            minRows={2}
            maxRows={8}
            value={v}
            onChange={(e) => set(a.anahtar, e.currentTarget.value)}
            style={{ gridColumn: '1 / -1' }}
            data-autofocus={a.anahtar === 'konu' && isNew ? true : undefined}
          />
        );
      case 'int': {
        // Küçük aralık (ör. Öncelik 1–3) seçim listesi olarak; aralık meta'dan (alanlar[].min/max)
        const { min, max } = a;
        if (min !== undefined && max !== undefined && max - min <= 10) {
          const range = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
          return (
            <Select key={a.anahtar} {...common} data={range} value={v || null} clearable onChange={(x) => set(a.anahtar, x ?? '')} />
          );
        }
        return (
          <NumberInput
            key={a.anahtar}
            {...common}
            value={v}
            min={min ?? 0}
            max={max}
            clampBehavior="strict"
            allowDecimal={false}
            onChange={(x) => set(a.anahtar, x === '' ? '' : String(x))}
          />
        );
      }
      case 'date':
        return (
          <DateInput
            key={a.anahtar}
            {...common}
            value={v || null}
            valueFormat="DD.MM.YYYY"
            placeholder="GG.AA.YYYY"
            clearable
            onChange={(x) => set(a.anahtar, x ?? '')}
          />
        );
      default:
        return <TextInput key={a.anahtar} {...common} value={v} onChange={(e) => set(a.anahtar, e.currentTarget.value)} />;
    }
  };

  const opm = existing?.opm as Opm | null | undefined;
  const suggestion = existing ? opmSuggestion(existing, roles) : null;
  const fieldLabel = (k: string) => meta.alanlar.find((a) => a.anahtar === k)?.etiket ?? k;
  const fieldType = (k: string) => meta.alanlar.find((a) => a.anahtar === k)?.tip;
  const show = (k: string, v: string | null) =>
    v === null || v === '' ? <i>boş</i> : fieldType(k) === 'date' ? fmtDate(v) : v;

  return (
    <Drawer
      opened
      onClose={() => void close()}
      position="right"
      size="xl"
      closeButtonProps={{ 'aria-label': 'Kapat' }}
      title={
        <Group gap="xs" wrap="nowrap">
          {existing && <StatusBadge durum={str(existing, 'durum')} />}
          <Text component="span" fw={700} size="lg" lineClamp={1}>
            {existing ? taskTitle(existing, generic) : 'Yeni İş'}
          </Text>
        </Group>
      }
    >
      <Stack>
        <SimpleGrid cols={2}>{alanlar.map(field)}</SimpleGrid>

        {opm && (
          <Card withBorder>
            <Title order={3} size="h5" mb="xs">
              OPM kaydı
            </Title>
            <Group gap="xs" mb="xs">
              <Text fw={700}>{opm.kod}</Text>
              {opm.durum && <Badge variant="outline">{opm.durum}</Badge>}
              {suggestion && (
                <>
                  <Badge color="orange" variant="light">
                    Bizdeki durum: {str(existing as Task, 'durum')} → önerilen: {suggestion}
                  </Badge>
                  <Button size="compact-sm" onClick={() => set('durum', suggestion)}>
                    Uygula
                  </Button>
                </>
              )}
            </Group>
            <SimpleGrid cols={2} spacing={4}>
              <Text size="sm" c="dimmed">Konu</Text>
              <Text size="sm">{opm.konu ?? '—'}</Text>
              <Text size="sm" c="dimmed">Atanan</Text>
              <Text size="sm">{opm.atanan ?? '—'}</Text>
              <Text size="sm" c="dimmed">Öncelik / Tür</Text>
              <Text size="sm">
                {opm.oncelik ?? ''} · {opm.tur ?? ''}
              </Text>
              <Text size="sm" c="dimmed">Modül</Text>
              <Text size="sm">{opm.modul ?? '—'}</Text>
              <Text size="sm" c="dimmed">Oluşturma</Text>
              <Text size="sm">{opm.olusturma ?? ''}</Text>
              <Text size="sm" c="dimmed">Son güncelleme</Text>
              <Text size="sm">{opm.son_guncelleme ?? ''}</Text>
            </SimpleGrid>
          </Card>
        )}

        <Group>
          <Button onClick={() => void save()} loading={saving}>
            {isNew ? 'Oluştur' : 'Kaydet'}
          </Button>
          <Button variant="default" onClick={() => void close()}>
            Kapat
          </Button>
          {!isNew && (
            <Button color="red" variant="subtle" ml="auto" onClick={() => void del()}>
              Sil
            </Button>
          )}
        </Group>

        {!isNew && (
          <Box>
            <Title order={3} size="h5" mb="xs">
              Yorumlar & Tarihçe
            </Title>
            <Textarea
              aria-label="Yorum"
              placeholder="Not ekle… (Ctrl+Enter ile kaydet)"
              autosize
              minRows={2}
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) void addComment();
              }}
            />
            <Group justify="flex-end" mt={6}>
              <Button size="xs" onClick={() => void addComment()}>
                Yorum ekle
              </Button>
            </Group>
            {timeline === null ? (
              <Loading />
            ) : timeline.length === 0 ? (
              <Text size="sm" c="dimmed">
                Henüz yorum veya değişiklik yok
              </Text>
            ) : (
              <Stack gap={6} mt="sm" component="ul" style={{ listStyle: 'none', padding: 0 }} aria-label="Tarihçe">
                {timeline.map((i) => (
                  <Box component="li" key={`${i.tip}-${i.id}`}>
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <Text size="xs" c="dimmed" w={120}>
                        {i.tip === 'yorum' && i.ice_aktarim ? "Excel'den aktarılan not" : fmtTs(i.zaman)}
                      </Text>
                      <Box style={{ flex: 1 }}>
                        {i.tip === 'yorum' ? (
                          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                            {i.metin}
                          </Text>
                        ) : i.alan === '_olusturma' ? (
                          <Text size="sm">İş oluşturuldu</Text>
                        ) : (
                          <Text size="sm">
                            <b>{fieldLabel(i.alan)}</b>:{' '}
                            <Text span td="line-through" c="dimmed">
                              {show(i.alan, i.eski)}
                            </Text>{' '}
                            → {show(i.alan, i.yeni)}
                          </Text>
                        )}
                      </Box>
                      {i.tip === 'yorum' && (
                        <ActionIcon size="sm" variant="subtle" color="red" aria-label="Yorumu sil" onClick={() => void delComment(i.id)}>
                          ✕
                        </ActionIcon>
                      )}
                    </Group>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Stack>
    </Drawer>
  );
}
