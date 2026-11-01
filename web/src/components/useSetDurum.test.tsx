import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '../Providers';
import { defaultRoutes, stubApi } from '../test/render';
import { useAppData } from './AppData';
import { useSetDurum } from './useSetDurum';

describe('useSetDurum', () => {
  it('L-1: boş durum PATCH göndermez', async () => {
    const calls = stubApi(defaultRoutes());
    const { result } = renderHook(() => ({ setDurum: useSetDurum(), data: useAppData() }), { wrapper: Providers });
    await waitFor(() => expect(result.current.data.status).toBe('ready'));
    await act(() => result.current.setDurum(1, ''));
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});
