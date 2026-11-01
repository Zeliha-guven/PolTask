import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TASKS, task } from '../../test/fixtures';
import { fail, ok, renderApp } from '../../test/render';

function dataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? '',
    effectAllowed: 'move',
    dropEffect: 'move',
  };
}

function drag(card: HTMLElement, column: HTMLElement) {
  const dt = dataTransfer();
  fireEvent.dragStart(card, { dataTransfer: dt });
  fireEvent.dragOver(column, { dataTransfer: dt });
  fireEvent.drop(column, { dataTransfer: dt });
}

describe('Pano', () => {
  it('yükleniyor', () => {
    renderApp('#/pano', { 'GET /api/meta': 'pending' });
    expect(screen.getByRole('status', { name: 'Yükleniyor' })).toBeInTheDocument();
  });

  it('boş', async () => {
    renderApp('#/pano', { 'GET /api/tasks': ok([]) });
    expect(await screen.findByText('Henüz iş yok')).toBeInTheDocument();
  });

  it('hata', async () => {
    renderApp('#/pano', { 'GET /api/tasks': fail(500, 'Pano yüklenemedi') });
    expect(await screen.findByText('Veriler yüklenemedi')).toBeInTheDocument();
  });

  it('başarı: meta sırasıyla kolonlar, kartlar doğru kolonda, iptal kolonu katlı', async () => {
    renderApp('#/pano');
    const cols = await screen.findAllByRole('region', { name: /^Kolon: / });
    expect(cols.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Kolon: Başlamadı',
      'Kolon: Beklemede',
      'Kolon: Geliştirmede',
      'Kolon: Testte',
      'Kolon: Tamamlandı',
      'Kolon: İptal',
    ]);
    expect(within(screen.getByTestId('col-Geliştirmede')).getByTestId('card-1')).toBeInTheDocument();
    expect(within(screen.getByTestId('col-Testte')).getByText('OPM: Çözüldü')).toBeInTheDocument();
    expect(within(screen.getByTestId('col-İptal')).getByRole('button', { name: 'Göster' })).toBeInTheDocument();
  });

  it('sürükle-bırak durumu PATCH ile değiştirir', async () => {
    const { calls } = renderApp('#/pano', {
      'PATCH /api/tasks/1': (body) => ok({ ...TASKS[0], ...(body as object) }),
    });
    const card = await screen.findByTestId('card-1');
    drag(card, screen.getByTestId('col-Testte'));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: '/api/tasks/1', body: { durum: 'Testte' } }));
    await waitFor(() => expect(within(screen.getByTestId('col-Testte')).getByTestId('card-1')).toBeInTheDocument());
  });

  it('AC-4 / BR-2: Tamamlandıya bırakınca %100 + bugünün bitiş tarihi önerilir, kabul edilirse gönderilir', async () => {
    const { calls } = renderApp('#/pano', {
      'PATCH /api/tasks/1': (body) => ok({ ...TASKS[0], ...(body as object) }),
    });
    drag(await screen.findByTestId('card-1'), screen.getByTestId('col-Tamamlandı'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Tamamlanma % 100 ve Bitiş Tarihi bugün/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Evet, ayarla' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        durum: 'Tamamlandı',
        yuzde: 100,
        bitis_tarihi: '2026-10-28',
      }),
    );
  });

  it('BR-2 önerisi reddedilirse yalnız durum gönderilir', async () => {
    const { calls } = renderApp('#/pano', {
      'PATCH /api/tasks/1': (body) => ok({ ...TASKS[0], ...(body as object) }),
    });
    drag(await screen.findByTestId('card-1'), screen.getByTestId('col-Tamamlandı'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ durum: 'Tamamlandı' }));
  });

  it('kolon başına 40 kart sınırı ve "daha fazla"', async () => {
    const many = Array.from({ length: 45 }, (_, i) => task({ id: 100 + i, durum: 'Beklemede' }));
    renderApp('#/pano', { 'GET /api/tasks': ok(many) });
    const col = await screen.findByTestId('col-Beklemede');
    expect(within(col).getAllByTestId(/card-/)).toHaveLength(40);
    fireEvent.click(within(col).getByRole('button', { name: '+ 5 iş daha göster' }));
    expect(within(col).getAllByTestId(/card-/)).toHaveLength(45);
  });
});
