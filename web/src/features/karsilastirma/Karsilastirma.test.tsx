import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SNAPSHOTS } from '../../test/fixtures';
import { fail, ok, renderApp } from '../../test/render';

describe('Karşılaştırma', () => {
  it('yükleniyor: açılışta haftalık snapshot isteği gönderilir', async () => {
    const { calls } = renderApp('#/karsilastirma', { 'GET /api/snapshots': 'pending' });
    await waitFor(() =>
      expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(
        expect.arrayContaining(['POST /api/snapshots/haftalik', 'GET /api/snapshots']),
      ),
    );
    expect(screen.getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
    const iPost = calls.findIndex((c) => c.url === '/api/snapshots/haftalik');
    const iGet = calls.findIndex((c) => c.url === '/api/snapshots');
    expect(iPost).toBeLessThan(iGet);
  });

  it('boş: snapshot yoksa', async () => {
    renderApp('#/karsilastirma', { 'GET /api/snapshots': ok([]), 'GET /api/tasks': ok([]) });
    expect(await screen.findByText('Henüz anlık görüntü yok')).toBeInTheDocument();
    expect(screen.getByText('Grafik için anlık görüntü yok')).toBeInTheDocument();
  });

  it('hata: liste alınamazsa tekrar dene', async () => {
    renderApp('#/karsilastirma', { 'GET /api/snapshots': fail(500, 'Snapshot okunamadı') });
    expect(await screen.findByText('Veriler yüklenemedi')).toBeInTheDocument();
    expect(await screen.findByText('Snapshot okunamadı')).toBeInTheDocument();
  });

  it('başarı: son geçmiş snapshot ↔ canlı farkı gösterilir', async () => {
    renderApp('#/karsilastirma');
    const table = await screen.findByRole('table', { name: 'Karşılaştırma' });
    // Canlı: Ek İstek → Geliştirmede 1, Tamamlandı 1; Bug fix → Testte 1 (26.10 snapshot ile aynı)
    const ekIstek = within(table).getByText('Ek İstek').closest('tr') as HTMLElement;
    expect(ekIstek).toHaveTextContent('2');
    expect(screen.getByRole('combobox', { name: 'Önceki' })).toHaveValue('11');
    expect(screen.getByRole('combobox', { name: 'Sonraki' })).toHaveValue('live');
    fireEvent.change(screen.getByRole('combobox', { name: 'Önceki' }), { target: { value: '10' } });
    // 19.10: Ek İstek Geliştirmede 2 → canlı 1 : fark -1
    await waitFor(() => expect(within(table).getAllByText('-1').length).toBeGreaterThan(0));
    expect(screen.getByText('26 Ekim haftası')).toBeInTheDocument();
  });

  it('anlık görüntü al ve sil', async () => {
    const { calls } = renderApp('#/karsilastirma', {
      'POST /api/snapshots': ok({ id: 12 }),
      'DELETE /api/snapshots/10': { status: 204 },
    });
    await screen.findByRole('table', { name: 'Karşılaştırma' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Etiket' }), { target: { value: 'Elle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anlık görüntü al' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url === '/api/snapshots')?.body).toEqual({ etiket: 'Elle' }));
    expect(await screen.findByText('Anlık görüntü alındı')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Sil: 19.10.2026 ${SNAPSHOTS[0]!.etiket}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sil' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/snapshots/10')).toBe(true));
  });
});
