import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/render';
import { COLOR_SCHEME_KEY } from '../theme';

describe('Tema (AC-6)', () => {
  it('açık / koyu / sistem değişir ve hatırlanır', async () => {
    const { unmount } = renderApp('#/ozet');
    await screen.findByTestId('kpi-acik');
    fireEvent.click(screen.getByText('Koyu'));
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
    expect(window.localStorage.getItem(COLOR_SCHEME_KEY)).toBe('dark');
    unmount();

    // Yeniden açılışta seçim korunur
    renderApp('#/ozet');
    await screen.findByTestId('kpi-acik');
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
    fireEvent.click(screen.getByText('Sistem'));
    expect(window.localStorage.getItem(COLOR_SCHEME_KEY)).toBe('auto');
    fireEvent.click(screen.getByText('Açık'));
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light');
  });
});
