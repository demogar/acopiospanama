'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Callout, Code, Field, Input, Panel, Stack, Text } from '@demogar/mola-ui';
import { SiteFrame } from '@/components/site-frame';
import { ErrorState, Loading } from '@/components/states';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { SessionInfo } from '@/lib/account-types';
import { safeNext } from '@/lib/nav';
import { useApi } from '@/lib/use-api';

/** Segundo factor de moderación: configurarlo la primera vez, verificarlo en cada sesión. */
function SecurityInner() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('siguiente'), '/moderacion');
  const session = useApi<SessionInfo>('/auth/session');
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (session.data?.isStaff && session.data.mfaVerified && !recoveryCodes) router.replace(next);
  }, [session.data, recoveryCodes, next, router]);

  useEffect(() => {
    if (session.error?.status === 401)
      router.replace(`/entrar?siguiente=${encodeURIComponent(`/seguridad?siguiente=${next}`)}`);
  }, [session.error, next, router]);

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      setSetup(await api.post<{ qr: string; secret: string }>('/auth/mfa/setup'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code: code.replace(/\s/g, '') });
      setRecoveryCodes(r.recoveryCodes);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(
        '/auth/mfa/verify',
        useRecovery ? { recoveryCode: code.trim() } : { code: code.replace(/\s/g, '') },
      );
      router.replace(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : errorMessage(err),
      );
      setBusy(false);
    }
  }

  const skip = (
    <Link href="/mis-centros" className="inline-flex min-h-11 items-center text-sm underline">
      Ahora no: ir a mis centros
    </Link>
  );

  if (session.error && session.error.status !== 401)
    return (
      <SiteFrame width="prose" title="Seguridad">
        <ErrorState error={session.error} onRetry={session.reload} />
      </SiteFrame>
    );
  if (!session.data)
    return (
      <SiteFrame width="prose" title="Seguridad">
        <Loading />
      </SiteFrame>
    );
  const s = session.data;

  if (!s.isStaff) {
    return (
      <SiteFrame width="prose" title="Seguridad">
        <Stack gap="md">
          <Callout tone="info" title="No necesitas segundo factor">
            Entras solo con el código por correo. El segundo factor es para quienes moderan el directorio.
          </Callout>
          <Link href="/mis-centros" className="inline-flex min-h-11 items-center underline">
            Ir a mis centros
          </Link>
        </Stack>
      </SiteFrame>
    );
  }

  if (recoveryCodes) {
    return (
      <SiteFrame width="prose" title="Guarda tus códigos de recuperación">
        <Panel padding="lg">
          <Stack gap="md">
            <Callout tone="warn" title="Solo se muestran esta vez">
              Úsalos si pierdes el teléfono. Cada código sirve una sola vez. Guárdalos en tu gestor de contraseñas o en
              papel, no en un chat.
            </Callout>
            <ul className="grid grid-cols-2 gap-2" aria-label="Códigos de recuperación">
              {recoveryCodes.map((c) => (
                <li key={c}>
                  <Code>{c}</Code>
                </li>
              ))}
            </ul>
            <Button size="lg" onClick={() => router.replace(next)}>
              Ya los guardé
            </Button>
          </Stack>
        </Panel>
      </SiteFrame>
    );
  }

  if (!s.mfaEnrolled) {
    return (
      <SiteFrame width="prose" title="Configura tu segundo factor" subtitle="Obligatorio para moderar el directorio.">
        <Stack gap="md">
          <Panel padding="lg">
            {!setup ? (
              <Stack gap="md">
                <Text>
                  Necesitas una app de autenticación en tu teléfono (Google Authenticator, Microsoft Authenticator,
                  1Password, Bitwarden u otra). Así, aunque alguien entre a tu correo, no puede retirar centros ni
                  bloquear cuentas.
                </Text>
                {error && (
                  <Callout tone="danger" role="alert">
                    {error}
                  </Callout>
                )}
                <Button size="lg" loading={busy} onClick={startSetup}>
                  Empezar
                </Button>
              </Stack>
            ) : (
              <form onSubmit={enable}>
                <Stack gap="md">
                  <Text>1. Escanea este código con tu app de autenticación.</Text>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setup.qr}
                    alt="Código QR para tu app de autenticación"
                    width={240}
                    height={240}
                    className="bg-white p-2"
                  />
                  <Text size="sm" tone="muted">
                    ¿Estás en el mismo teléfono? Copia esta clave en la app:{' '}
                    <Code className="[overflow-wrap:anywhere]">{setup.secret}</Code>
                  </Text>
                  <Field label="2. Escribe el código de 6 dígitos que muestra la app" error={error ?? undefined}>
                    {(c) => (
                      <Input
                        {...c}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={8}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                    )}
                  </Field>
                  <Button type="submit" size="lg" loading={busy} disabled={code.replace(/\D/g, '').length !== 6}>
                    Activar
                  </Button>
                </Stack>
              </form>
            )}
          </Panel>
          {skip}
        </Stack>
      </SiteFrame>
    );
  }

  return (
    <SiteFrame width="prose" title="Verifica tu segundo factor" subtitle="Lo pedimos una vez por sesión para moderar.">
      <Stack gap="md">
        <Panel padding="lg">
          <form onSubmit={verify}>
            <Stack gap="md">
              <Field
                label={useRecovery ? 'Código de recuperación' : 'Código de 6 dígitos de tu app'}
                error={error ?? undefined}
              >
                {(c) => (
                  <Input
                    {...c}
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    maxLength={useRecovery ? 20 : 8}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                  />
                )}
              </Field>
              <Button type="submit" size="lg" loading={busy} disabled={!code.trim()}>
                Verificar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-auto! min-h-11 py-2 text-center leading-snug whitespace-normal!"
                onClick={() => {
                  setUseRecovery(!useRecovery);
                  setCode('');
                  setError(null);
                }}
              >
                {useRecovery ? 'Usar la app de autenticación' : 'Perdí el teléfono: usar un código de recuperación'}
              </Button>
            </Stack>
          </form>
        </Panel>
        {skip}
      </Stack>
    </SiteFrame>
  );
}

export default function SecurityPage() {
  return (
    <Suspense>
      <SecurityInner />
    </Suspense>
  );
}
