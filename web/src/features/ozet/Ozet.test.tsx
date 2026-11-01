import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fail, ok, renderApp } from '../../test/render';

describe('Özet', () => {
  it('yükleniyor', () => {
    renderApp('#/ozet', { 'GET /api/meta': 'pending' });
    expect(screen.getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
  });

  it('boş: iş yoksa içe aktarmaya yönlendirir', async () => {
    renderApp('#/ozet', { 'GET /api/tasks': ok([]) });
    expect(await screen.findByText('Henüz iş yok')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'İçe aktar' }));
    expect(await screen.findByText("Excel'den içe aktar")).toBeInTheDocument();
  });

  it('hata: sunucu mesajı bildirimde, tekrar dene düğmesi', async () => {
    renderApp('#/ozet', { 'GET /api/tasks': fail(500, 'Veritabanı açılamadı') });
    expect(await screen.findByText('Veriler yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('Veritabanı açılamadı')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument();
  });

  it('başarı: KPI kutuları doğru sayar (BR-1, BR-3) ve pivot hücresi filtreli Listeye götürür', async () => {
    renderApp('#/ozet');
    expect(await screen.findByTestId('kpi-acik')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-linktera')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-gecikmis')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-uat_hafta')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-opm_uyumsuz')).toHaveTextContent('1');

    const pivot = screen.getByRole('table', { name: 'Pivot' });
    fireEvent.click(within(pivot).getByRole('button', { name: 'Bug fix / Testte' }));
    const list = await screen.findByRole('table', { name: 'İş listesi' });
    await waitFor(() => expect(within(list).getAllByTestId(/task-row-/)).toHaveLength(1));
    expect(within(list).getByText('Mutabakat servisi')).toBeInTheDocument();
  });

  it('L-2: geçersiz kayıtlı pivot boyutunda Kapsam Tipi × Durum varsayılanı; seçim önekli anahtarla saklanır', async () => {
    window.localStorage.setItem('poltask.web.pivotRow', 'olmayan_alan');
    window.localStorage.setItem('poltask.web.pivotCol', 'olmayan_alan');
    renderApp('#/ozet');
    expect(await screen.findByRole('combobox', { name: 'Satır' })).toHaveValue('kapsam_tipi');
    expect(screen.getByRole('combobox', { name: 'Kolon' })).toHaveValue('durum');
    fireEvent.change(screen.getByRole('combobox', { name: 'Satır' }), { target: { value: 'kimde_bekliyor' } });
    expect(window.localStorage.getItem('poltask.web.pivotRow')).toBe('kimde_bekliyor');
  });

  it('KPI kutusu Listeyi özel filtreyle açar', async () => {
    renderApp('#/ozet');
    fireEvent.click(await screen.findByText('Hedef tarihi geçmiş', { selector: 'p' }));
    const list = await screen.findByRole('table', { name: 'İş listesi' });
    expect(within(list).getAllByTestId(/task-row-/)).toHaveLength(1);
    expect(within(list).getByText('Kart limit ekranı')).toBeInTheDocument();
  });
});
