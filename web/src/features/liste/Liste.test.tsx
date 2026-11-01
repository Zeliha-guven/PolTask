import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TASKS } from '../../test/fixtures';
import { fail, ok, renderApp } from '../../test/render';

describe('Liste', () => {
  it('yükleniyor', () => {
    renderApp('#/liste', { 'GET /api/tasks': 'pending' });
    expect(screen.getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
  });

  it('boş: iş yok', async () => {
    renderApp('#/liste', { 'GET /api/tasks': ok([]) });
    expect(await screen.findByText('Henüz iş yok')).toBeInTheDocument();
  });

  it('boş: filtreye uyan iş yok', async () => {
    renderApp('#/liste');
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Ara' }), { target: { value: 'eşleşmeyen-metin' } });
    expect(await screen.findByText('Filtreye uyan iş yok')).toBeInTheDocument();
  });

  it('hata', async () => {
    renderApp('#/liste', { 'GET /api/meta': fail(500, 'Sunucu hatası oluştu') });
    expect(await screen.findByText('Veriler yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('Sunucu hatası oluştu')).toBeInTheDocument();
  });

  it('başarı: Ana Başlığa göre gruplar, GG.AA.YYYY tarih, BR-1 ve BR-3 işaretleri doğru işlerde', async () => {
    renderApp('#/liste');
    const list = await screen.findByRole('table', { name: 'İş listesi' });
    expect(within(list).getByText('Ödeme')).toBeInTheDocument();
    expect(within(list).getByText('Raporlama')).toBeInTheDocument();

    const late = within(list).getByTestId('task-row-1');
    expect(within(late).getByText('Gecikmiş')).toBeInTheDocument();
    expect(within(late).getByText('20.10.2026')).toBeInTheDocument();

    const done = within(list).getByTestId('task-row-2');
    expect(within(done).queryByText('Gecikmiş')).toBeNull();
    expect(within(done).queryByText(/^OPM:/)).toBeNull();

    const opm = within(list).getByTestId('task-row-3');
    expect(within(opm).getByText('OPM: Çözüldü')).toBeInTheDocument();
    expect(within(opm).queryByText('Gecikmiş')).toBeNull();
    expect(within(opm).getByText('15.11.2026')).toBeInTheDocument();
  });

  it('satır içi durum değişikliği PATCH gönderir', async () => {
    const { calls } = renderApp('#/liste', {
      'PATCH /api/tasks/1': (body) => ok({ ...TASKS[0], ...(body as object) }),
    });
    const select = await screen.findByRole('combobox', { name: 'Durum: Kart limit ekranı' });
    fireEvent.change(select, { target: { value: 'Testte' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: '/api/tasks/1', body: { durum: 'Testte' } });
    expect(await screen.findByText('Durum: Testte')).toBeInTheDocument();
  });

  it('L-1: boş durum seçimi PATCH göndermez', async () => {
    const { calls } = renderApp('#/liste');
    const select = await screen.findByRole('combobox', { name: 'Durum: Kart limit ekranı' });
    fireEvent.change(select, { target: { value: '' } });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('L-2: kendi önekli anahtarları kullanır; geçersiz kayıtta varsayılan kolonlar', async () => {
    window.localStorage.setItem('poltask.cols', JSON.stringify(['cr_no']));
    window.localStorage.setItem('poltask.web.cols', 'bozuk-json');
    renderApp('#/liste');
    const list = await screen.findByRole('table', { name: 'İş listesi' });
    const headers = within(list).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Konu', 'Kapsam Tipi', 'Tamamlanma Durumu', 'Tamamlanma %', 'Kimde Bekliyor?', 'Öncelik', 'OPM No', 'Hedef Teslim',
      'Talep Sorumlusu',
    ]);
  });

  it('sıralama ve filtre çalışır, satır tıklaması detayı açar', async () => {
    renderApp('#/liste');
    await screen.findByRole('table', { name: 'İş listesi' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Kimde Bekliyor?' }), { target: { value: 'TurkOnay' } });
    await waitFor(() => expect(screen.getAllByTestId(/task-row-/)).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '✕ Filtreleri temizle' }));
    await waitFor(() => expect(screen.getAllByTestId(/task-row-/)).toHaveLength(3));
    fireEvent.click(screen.getByText('Mutabakat servisi'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/liste?is=3');
  });
});
