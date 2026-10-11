/**
 * Solo rutas internas: evita redirecciones abiertas a otros dominios. Se interpreta el valor como
 * lo haría el navegador (`/\t/evil.com`, `/\\evil.com`, `//evil.com`…) y se acepta solo si queda en
 * el mismo origen. Funciona en servidor y cliente.
 */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/')) return fallback;
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  let u: URL;
  try {
    u = new URL(value, base);
  } catch {
    return fallback;
  }
  if (u.origin !== base) return fallback;
  if (u.pathname === '/entrar' || u.pathname.startsWith('/entrar/')) return fallback;
  return u.pathname + u.search + u.hash;
}
