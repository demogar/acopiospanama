'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Callout, Field, Input, Panel, Stack, Text } from '@demogar/mola-ui';
import { SiteFrame } from '@/components/site-frame';
import { api, ApiError, errorMessage } from '@/lib/api';
import { safeNext } from '@/lib/nav';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('siguiente'), '/mis-centros');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo válido, por ejemplo nombre@gmail.com.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ message: string; cooldownSeconds: number }>('/auth/request-code', {
        email: email.trim(),
      });
      setCooldown(r.cooldownSeconds);
      setStep('code');
      setCode('');
    } catch (err) {
      if (err instanceof ApiError && typeof err.data.retryAfter === 'number') setCooldown(err.data.retryAfter);
      if (err instanceof ApiError && err.status === 429)
        setError('Pediste muchos códigos seguidos. Espera unos minutos e intenta de nuevo.');
      else setError(err instanceof ApiError ? (err.fields.email ?? err.message) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ isStaff: boolean; mfaEnrolled: boolean }>('/auth/verify-code', {
        code: code.replace(/\D/g, ''),
      });
      if (r.isStaff)
        router.replace(`/seguridad?siguiente=${encodeURIComponent(params.get('siguiente') ? next : '/moderacion')}`);
      else router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Demasiados intentos. Espera unos minutos y pide un código nuevo.'
          : errorMessage(err),
      );
      setBusy(false);
    }
  }

  return (
    <SiteFrame width="prose" title="Entrar" subtitle="Para publicar un centro de acopio o mantener los tuyos al día.">
      <Stack gap="lg">
        <Panel padding="lg">
          {step === 'email' ? (
            <form onSubmit={requestCode} noValidate>
              <Stack gap="md">
                <Field label="Tu correo" hint="Te enviamos un código de 8 dígitos." error={error ?? undefined}>
                  {(c) => (
                    <Input
                      {...c}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" loading={busy} disabled={cooldown > 0}>
                  {cooldown > 0 ? `Espera ${cooldown} s` : 'Recibir código'}
                </Button>
                <Text size="sm" tone="muted">
                  Sin contraseñas. Tu correo nunca se publica: solo lo usamos para que entres y para recordarte que
                  confirmes tus centros.
                </Text>
              </Stack>
            </form>
          ) : (
            <form onSubmit={verify} noValidate>
              <Stack gap="md">
                <div aria-live="polite">
                  <Callout tone="info" title="Revisa tu correo">
                    Te enviamos un código a <strong className="[overflow-wrap:anywhere]">{email}</strong>. Si no lo ves
                    en unos minutos, busca en correo no deseado o promociones.
                  </Callout>
                </div>
                <Field label="Código de 8 dígitos" hint="Vence en 10 minutos." error={error ?? undefined}>
                  {(c) => (
                    <Input
                      {...c}
                      ref={codeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^\d\s-]/g, ''))}
                      maxLength={12}
                      className="font-mono tracking-[0.3em]"
                    />
                  )}
                </Field>
                <Button type="submit" size="lg" loading={busy} disabled={code.replace(/\D/g, '').length !== 8}>
                  Entrar
                </Button>
                <div className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep('email');
                      setError(null);
                    }}
                  >
                    Cambiar correo
                  </Button>
                  <Button type="button" variant="ghost" disabled={cooldown > 0 || busy} onClick={() => requestCode()}>
                    {cooldown > 0 ? `Reenviar en ${cooldown} s` : 'Reenviar código'}
                  </Button>
                </div>
                <Text size="sm" tone="muted">
                  Escribe el código en este mismo navegador. Si lo pediste varias veces, usa el del correo más reciente.
                </Text>
              </Stack>
            </form>
          )}
        </Panel>
        <Text size="sm" tone="muted">
          Para ver los centros y qué necesitan no hace falta entrar.
        </Text>
      </Stack>
    </SiteFrame>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
