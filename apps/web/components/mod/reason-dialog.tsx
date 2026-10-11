'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, Field, Stack, Text, Textarea } from '@demogar/mola-ui';
import { DialogContentEs } from '@/components/ui/dialog-es';
import { ApiError, errorMessage } from '@/lib/api';

/** Diálogo para acciones de moderación que exigen motivo (queda en el registro de auditoría). */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  extra,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  extra?: React.ReactNode;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError('Indica el motivo (queda en el registro).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CANCELLED') return;
      setError(err instanceof ApiError ? (err.fields.reason ?? err.message) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentEs title={title} size="sm">
        <form onSubmit={submit}>
          <Stack gap="md">
            <Text>{description}</Text>
            {extra}
            <Field
              label="Motivo"
              hint="Breve y concreto. Queda en el registro de moderación."
              error={error ?? undefined}
            >
              {(c) => (
                <Textarea
                  {...c}
                  rows={2}
                  autosize
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
              )}
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant={tone} loading={busy}>
                {confirmLabel}
              </Button>
            </div>
          </Stack>
        </form>
      </DialogContentEs>
    </Dialog>
  );
}
