'use client';

import { useState } from 'react';
import { Button, Callout, Dialog, Field, Radio, RadioGroup, Textarea, useToast } from '@demogar/mola-ui';
import { DialogContentEs } from '@/components/ui/dialog-es';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { PublicMeta } from '@/lib/public-types';

export function ReportDialog({
  open,
  onOpenChange,
  centerId,
  centerName,
  meta,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centerId: string;
  centerName: string;
  meta: PublicMeta | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = () => {
    setReason(null);
    setDetails('');
    setError(null);
    setFieldError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setFieldError('Elige un motivo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ message: string; duplicate?: boolean }>(`/public/centers/${centerId}/report`, {
        reason,
        details: details.trim(),
      });
      if (r.duplicate)
        toast.info({ title: 'Ya habías reportado este centro', description: 'Cada persona cuenta una vez. Gracias.' });
      else toast.success({ title: 'Reporte enviado', description: r.message });
      onOpenChange(false);
      reset();
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.fields.reason) setFieldError(err.fields.reason);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reasons = Object.entries(meta?.reportReasons ?? {});

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContentEs
        title="Reportar un problema"
        description={`¿Qué pasa con «${centerName}»? Tu reporte es anónimo.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" form="report-form" variant="danger" loading={busy}>
              Enviar reporte
            </Button>
          </>
        }
      >
        <form id="report-form" onSubmit={submit} className="grid gap-4" noValidate>
          {reasons.length === 0 ? (
            <p className="text-ink-2">Cargando motivos…</p>
          ) : (
            <div className="grid gap-1">
              <RadioGroup
                label="Motivo"
                value={reason}
                onValueChange={(v) => {
                  setReason(v as string);
                  setFieldError(null);
                }}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? 'report-reason-error' : undefined}
              >
                {reasons.map(([key, label]) => (
                  <Radio key={key} value={key} label={label} />
                ))}
              </RadioGroup>
              {fieldError && (
                <p id="report-reason-error" role="alert" className="text-sm text-ink-danger">
                  {fieldError}
                </p>
              )}
            </div>
          )}
          {reason === 'MY_DATA' && (
            <Callout tone="info">
              Al enviarlo, el contacto publicado (nombre, teléfono y WhatsApp) se oculta de inmediato hasta que el
              responsable lo revise. Cuéntanos en los detalles qué dato es tuyo, sin repetirlo.
            </Callout>
          )}
          {reason === 'ASKS_MONEY' && (
            <Callout tone="info">
              No transfieras dinero. Si ya lo hiciste, denúncialo también a la policía o a tu banco.
            </Callout>
          )}
          <Field label="Detalles (opcional)" hint="Qué viste o cuándo. No pongas datos personales.">
            {(c) => (
              <Textarea {...c} rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
            )}
          </Field>
          <p className="text-sm text-ink-2">
            Si varias personas reportan lo mismo, el centro se marca o se oculta automáticamente hasta que su
            responsable lo revise.
          </p>
          {error && (
            <Callout tone="danger" role="alert">
              {error}
            </Callout>
          )}
        </form>
      </DialogContentEs>
    </Dialog>
  );
}
