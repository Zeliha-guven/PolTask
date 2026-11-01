import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TASKS } from '../../test/fixtures';
import { fail, ok, renderApp } from '../../test/render';

const TIMELINE = [
  { tip: 'yorum', id: 7, metin: 'Linktera ile görüşüldü', zaman: '2026-10-27T14:05:00', ice_aktarim: 0 },
  { tip: 'degisiklik', id: 3, alan: 'hedef_tarih', eski: '2026-10-10', yeni: '2026-10-20', zaman: '2026-10-21T09:00:00' },
  { tip: 'degisiklik', id: 1, alan: '_olusturma', eski: null, yeni: null, zaman: '2026-10-01T09:00:00' },
];

describe('İş detayı', () => {
  it('yükleniyor: tarihçe beklenirken', async () => {
    renderApp('#/liste?is=1', { 'GET /api/tasks/1/timeline': 'pending' });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
  });

  it('boş: yorum ve değişiklik yok', async () => {
    renderApp('#/liste?is=1', { 'GET /api/tasks/1/timeline': ok([]) });
    expect(await screen.findByText('Henüz yorum veya değişiklik yok')).toBeInTheDocument();
  });

  it('hata: olmayan iş ve tarihçe hatası', async () => {
    renderApp('#/liste?is=999');
    expect(await screen.findByText('Bu iş bulunamadı veya silinmiş.')).toBeInTheDocument();
  });

  it('hata: tarihçe alınamazsa bildirim', async () => {
    renderApp('#/liste?is=1', { 'GET /api/tasks/1/timeline': fail(500, 'Tarihçe okunamadı') });
    expect(await screen.findByText('Tarihçe okunamadı')).toBeInTheDocument();
  });

  it('başarı: /?is= derin bağlantısı açar; alanlar meta etiketleriyle, tarihler GG.AA.YYYY; tarihçe', async () => {
    renderApp('?is=1', { 'GET /api/tasks/1/timeline': ok(TIMELINE) });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Hedef Teslim (Linktera)' })).toHaveValue('20.10.2026');
    expect(within(dialog).getByRole('textbox', { name: 'Konu' })).toHaveValue('Kart limit ekranı');
    expect(within(dialog).queryByLabelText('İçerik Detayı-Tarihçe')).toBeNull();
    expect(await within(dialog).findByText('Linktera ile görüşüldü')).toBeInTheDocument();
    expect(within(dialog).getByText('27.10.2026 14:05')).toBeInTheDocument();
    expect(within(dialog).getByText('10.10.2026')).toBeInTheDocument();
    expect(within(dialog).getByText('İş oluşturuldu')).toBeInTheDocument();
  });

  it('düzenle + kaydet yalnız değişen alanları PATCH eder', async () => {
    const { calls } = renderApp('#/liste?is=1', {
      'GET /api/tasks/1/timeline': ok([]),
      'PATCH /api/tasks/1': (body) => ok({ ...TASKS[0], ...(body as object) }),
    });
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Kimde Bekliyor?' }), { target: { value: 'Banka' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: '/api/tasks/1', body: { kimde_bekliyor: 'Banka' } }),
    );
    expect(await screen.findByText('Kaydedildi')).toBeInTheDocument();
  });

  it('OPM kutusu: Uygula önerilen durumu forma yazar (BR-3)', async () => {
    const { calls } = renderApp('#/liste?is=3', {
      'GET /api/tasks/3/timeline': ok([]),
      'PATCH /api/tasks/3': (body) => ok({ ...TASKS[2], ...(body as object) }),
    });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('OPM kaydı')).toBeInTheDocument();
    expect(within(dialog).getByText(/önerilen: Tamamlandı/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Uygula' }));
    expect(within(dialog).getByLabelText('Tamamlanma Durumu')).toHaveValue('Tamamlandı');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    // BR-2: bitiş tarihi yok → öneri penceresi
    const confirmBox = await screen.findByText(/Bitiş Tarihi bugün ve Tamamlanma % 100/);
    fireEvent.click(within(confirmBox.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Evet, ayarla' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ durum: 'Tamamlandı', bitis_tarihi: '2026-10-28', yuzde: 100 }),
    );
  });

  it('yorum ekle ve sil', async () => {
    const { calls } = renderApp('#/liste?is=1', {
      'GET /api/tasks/1/timeline': ok(TIMELINE),
      'POST /api/tasks/1/comments': { status: 201 },
      'DELETE /api/comments/7': { status: 204 },
    });
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Yorum' }), { target: { value: 'Yeni not' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yorum ekle' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toMatchObject({ body: { metin: 'Yeni not' } }));

    fireEvent.click(await within(dialog).findByRole('button', { name: 'Yorumu sil' }));
    const confirmBox = await screen.findByText('Yorum silinsin mi?');
    fireEvent.click(within(confirmBox.closest('[role="dialog"]') as HTMLElement).getByRole('button', { name: 'Sil' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/comments/7')).toBe(true));
  });

  it('yeni iş: Konu zorunlu, sonra POST', async () => {
    const { calls } = renderApp('#/liste', {
      'POST /api/tasks': (body) => ok({ id: 50, ...(body as object) }),
    });
    await screen.findByRole('table', { name: 'İş listesi' });
    fireEvent.click(screen.getByRole('button', { name: '+ Yeni İş' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Tamamlanma Durumu')).toHaveValue('Başlamadı');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Oluştur' }));
    expect(await screen.findByText('Konu zorunlu')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Konu' }), { target: { value: 'Yeni ekran' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Oluştur' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
        konu: 'Yeni ekran',
        durum: 'Başlamadı',
        sozlesme: 'Dahil',
        opm_talep_tarihi: '2026-10-28',
      }),
    );
    expect(await screen.findByText('İş oluşturuldu')).toBeInTheDocument();
    // I-3: oluşturulan iş için çekmece yeniden açılır
    await waitFor(() => expect(window.location.hash).toBe('#/liste?is=50'));
  });

  it('L-1: Durum temizlenemez; Öncelik meta aralığında seçim listesi; Yüzde meta aralığıyla sınırlı', async () => {
    renderApp('#/liste?is=1', { 'GET /api/tasks/1/timeline': ok([]) });
    const dialog = await screen.findByRole('dialog');
    const durumWrapper = within(dialog).getByLabelText('Tamamlanma Durumu').closest('.mantine-InputWrapper-root') as HTMLElement;
    expect(durumWrapper.querySelector('.mantine-InputClearButton-root')).toBeNull();
    const oncelikWrapper = within(dialog).getByLabelText('Öncelik').closest('.mantine-InputWrapper-root') as HTMLElement;
    expect(oncelikWrapper.querySelector('.mantine-InputClearButton-root')).not.toBeNull();

    const oncelik = within(dialog).getByLabelText('Öncelik');
    fireEvent.click(oncelik);
    await waitFor(() => expect(oncelik).toHaveAttribute('aria-controls'));
    const listbox = document.getElementById(oncelik.getAttribute('aria-controls') ?? '') as HTMLElement;
    const options = within(listbox).getAllByRole('option', { hidden: true });
    expect(options.map((o) => o.textContent)).toEqual(['1', '2', '3']);

    const yuzde = within(dialog).getByLabelText('Tamamlanma %');
    fireEvent.change(yuzde, { target: { value: '150' } });
    expect(yuzde).not.toHaveValue('150');
  });

  it('başlıktaki durum rozeti kısalmaz (tam ad, daralmaz)', async () => {
    renderApp('#/liste?is=1', { 'GET /api/tasks/1/timeline': ok([]) });
    const dialog = await screen.findByRole('dialog');
    const badge = within(dialog).getAllByText('Geliştirmede')[0]!.closest('.mantine-Badge-root') as HTMLElement;
    expect(badge).toHaveStyle({ flexShrink: '0' });
  });
});
