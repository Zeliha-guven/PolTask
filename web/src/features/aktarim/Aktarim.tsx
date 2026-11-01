// İçe / Dışa Aktar: Excel içe aktar (BR-4, onaylı), OPM yükle, Excel indir.
import { Button, Card, FileButton, SimpleGrid, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { api } from '../../api/client';
import { useAppData } from '../../components/AppData';
import { useConfirm } from '../../components/Confirm';
import { notifySuccess } from '../../components/notify';
import { fmtTs } from '../../lib/dates';

export function Aktarim() {
  const { meta, reload } = useAppData();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<'excel' | 'opm' | null>(null);
  if (!meta) return null;

  const importExcel = async (f: File | null) => {
    if (!f) return;
    const ok = await confirm(
      `"${f.name}" içe aktarılacak.\nMevcut tüm işler, yorumlar ve değişiklik geçmişi silinecek. Devam edilsin mi?`,
      { confirmLabel: 'İçe aktar', danger: true },
    );
    if (!ok) return;
    setBusy('excel');
    try {
      const r = await api.importExcel(f);
      notifySuccess(
        `${r.isler} iş, ${r.gecmis_ozet} geçmiş özet${r.opm != null ? `, ${r.opm} OPM kaydı` : ''} aktarıldı`,
      );
      await reload();
    } catch {
      /* bildirim gösterildi */
    } finally {
      setBusy(null);
    }
  };

  const importOpm = async (f: File | null) => {
    if (!f) return;
    setBusy('opm');
    try {
      const r = await api.importOpm(f);
      notifySuccess(`${r.opm} OPM kaydı yüklendi, ${r.eslesen} iş eşleşti`);
      await reload();
    } catch {
      /* bildirim gösterildi */
    } finally {
      setBusy(null);
    }
  };

  return (
    <SimpleGrid cols={3}>
      <Card withBorder>
        <Title order={2} size="h4" mb="sm">
          Excel'den içe aktar
        </Title>
        <Text size="sm" mb="xs">
          "Linktera_Tüm_İşler" sayfasını içeren Excel'i yükleyin. "Karşılaştırmalı özet" sayfasındaki geçmiş
          haftalar ve "opm" sayfası da alınır.
        </Text>
        <Text size="sm" mb="sm" c="red" fw={600}>
          Dikkat: sitedeki tüm işler, yorumlar ve anlık görüntüler silinip yeniden oluşturulur.
        </Text>
        <FileButton onChange={(f) => void importExcel(f)} accept=".xlsx,.xlsm">
          {(props) => (
            <Button {...props} loading={busy === 'excel'}>
              Excel dosyası seç (.xlsx)
            </Button>
          )}
        </FileButton>
        <Text size="xs" c="dimmed" mt="sm">
          Son içe aktarım: {meta.son_ice_aktarim ? fmtTs(meta.son_ice_aktarim) : '—'} · {meta.is_sayisi} iş
        </Text>
      </Card>
      <Card withBorder>
        <Title order={2} size="h4" mb="sm">
          OPM export yükle
        </Title>
        <Text size="sm" mb="sm">
          OPM sisteminden aldığınız listeyi yükleyin. İşler OPM NO ile eşleşir; durumlar <b>otomatik değişmez</b>,
          uyumsuz olanlar işaretlenir.
        </Text>
        <FileButton onChange={(f) => void importOpm(f)} accept=".xlsx,.xlsm">
          {(props) => (
            <Button {...props} loading={busy === 'opm'}>
              OPM Excel dosyası seç (.xlsx)
            </Button>
          )}
        </FileButton>
        <Text size="xs" c="dimmed" mt="sm">
          Son OPM yüklemesi: {meta.son_opm_aktarim ? fmtTs(meta.son_opm_aktarim) : '—'} · {meta.opm_sayisi} kayıt
        </Text>
      </Card>
      <Card withBorder>
        <Title order={2} size="h4" mb="sm">
          Excel'e aktar
        </Title>
        <Text size="sm" mb="sm">
          Tüm işleri orijinal kolon düzeniyle ve "Güncel Durum" pivotuyla birlikte indirin. Yorumlar "İçerik
          Detayı-Tarihçe" kolonuna yazılır.
        </Text>
        <Button component="a" href={api.exportUrl} download>
          Excel indir
        </Button>
      </Card>
    </SimpleGrid>
  );
}
