// Söze dayalı onay penceresi: const ok = await confirm('…'). Tarayıcı confirm()'i yerine (klavye + tema uyumlu).
import { Button, Group, Modal, Text } from '@mantine/core';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ConfirmFn = (message: string, opts?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; confirmLabel: string; danger: boolean } | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, opts) => {
    setState({ message, confirmLabel: opts?.confirmLabel ?? 'Evet', danger: !!opts?.danger });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal opened={state !== null} onClose={() => close(false)} title="Onay" centered zIndex={400}>
        <Text style={{ whiteSpace: 'pre-line' }}>{state?.message}</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button color={state?.danger ? 'red' : undefined} onClick={() => close(true)} data-autofocus>
            {state?.confirmLabel}
          </Button>
        </Group>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
