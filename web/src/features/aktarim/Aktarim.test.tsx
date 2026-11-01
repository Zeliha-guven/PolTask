import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { META } from '../../test/fixtures';
import { fail, ok, renderApp } from '../../test/render';

function pickFile(input: HTMLInputElement, name: string) {
  const file = new File(['x'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  fireEvent.change(input, { target: { files: [file] } });
}

const fileInputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));

describe('İçe / Dışa Aktar', () => {
  it('yükleniyor', () => {
    renderApp('#/aktarim', { 'GET /api/meta': 'pending' });
    expect(screen.getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
  });

  it('boş: iş yokken de içe aktarma sunulur', async () => {
    renderApp('#/aktarim', {
      'GET /api/tasks': ok([]),
      'GET /api/meta': ok({ ...META, is_sayisi: 0, opm_sayisi: 0, son_ice_aktarim: null }),
    });
    expect(await screen.findByText(/Son içe aktarım: — · 0 iş/)).toBeInTheDocument();
  });

  it('hata', async () => {
    renderApp('#/aktarim', { 'GET /api/meta': fail(500, 'Meta okunamadı') });
    expect(await screen.findByText('Veriler yüklenemedi')).toBeInTheDocument();
  });

  it('başarı: son aktarım GG.AA.YYYY, Excel indir bağlantısı', async () => {
    renderApp('#/aktarim');
    expect(await screen.findByText(/Son içe aktarım: 20\.10\.2026 09:15 · 3 iş/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Excel indir' })).toHaveAttribute('href', '/api/export');
  });

  it('Excel içe aktarma onay ister (BR-4), onaydan sonra yükler ve veriyi yeniler', async () => {
    const { calls } = renderApp('#/aktarim', {
      'POST /api/import/excel': ok({ isler: 543, gecmis_ozet: 12, opm: 314 }),
    });
    await screen.findByText("Excel'den içe aktar");
    pickFile(fileInputs()[0]!, 'liste.xlsx');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/"liste.xlsx" içe aktarılacak/)).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/import/excel')).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'İçe aktar' }));
    expect(await screen.findByText('543 iş, 12 geçmiş özet, 314 OPM kaydı aktarıldı')).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/tasks').length).toBe(2));
  });

  it('OPM yükleme hatası bildirim olarak gösterilir', async () => {
    renderApp('#/aktarim', { 'POST /api/import/opm': fail(400, 'Lütfen .xlsx dosyası seçin') });
    await screen.findByText('OPM export yükle');
    pickFile(fileInputs()[1]!, 'opm.xlsx');
    expect(await screen.findByText('Lütfen .xlsx dosyası seçin')).toBeInTheDocument();
  });
});
