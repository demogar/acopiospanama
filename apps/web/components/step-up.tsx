'use client';

import { useCallback, useRef, useState } from 'react';
import { Button, Dialog, Field, Input, Stack, Text } from '@demogar/mola-ui';
import { DialogContentEs } from '@/components/ui/dialog-es';
import { api, ApiError, errorMessage } from '@/lib/api';

/**
 * Algunas acciones (exportar, cambiar el equipo, restablecer MFA) exigen confirmar el código de
 * autenticación de los últimos minutos. `run(fn)` ejecuta la acción y, si la API pide esa
 * confirmación, muestra el diálogo y la reintenta.
 */
export function useStepUp() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{
    fn: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  } | null>(null);

  const run = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    return fn().catch((err) => {
      if (err instanceof ApiError && err.code === 'STEP_UP_REQUIRED') {
        return new Promise<T>((resolve, reject) => {
          pending.current = { fn, resolve: resolve as (v: unknown) => void, reject };
          setCode('');
          setError(null);
          setOpen(true);
        });
      }
      throw err;
    });
  }, []);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!pending.current) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/mfa/verify', { code });
      const p = pending.current;
      pending.current = null;
      setOpen(false);
      p.fn().then(p.resolve, p.reject);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setOpen(false);
    pending.current?.reject(new ApiError(0, 'CANCELLED', 'Acción cancelada.'));
    pending.current = null;
  }

  const dialog = (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : cancel())}>
      <DialogContentEs
        title="Confirma que eres tú"
        description="Escribe el código de 6 dígitos de tu app de autenticación."
        size="sm"
      >
        <form onSubmit={confirm}>
          <Stack gap="md">
            <Field label="Código" error={error ?? undefined}>
              {(c) => (
                <Input
                  {...c}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  autoFocus
                />
              )}
            </Field>
            <Text size="sm" tone="muted">
              Por seguridad, lo pedimos para acciones sensibles.
            </Text>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={cancel}>
                Cancelar
              </Button>
              <Button type="submit" loading={busy}>
                Confirmar
              </Button>
            </div>
          </Stack>
        </form>
      </DialogContentEs>
    </Dialog>
  );

  return { run, dialog };
}
