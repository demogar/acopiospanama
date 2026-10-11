import type { ReactNode } from 'react';

/** Solo direcciones http(s): nunca `javascript:` ni otros esquemas que pudiera colar un texto libre. */
const URL_RE = /https?:\/\/[^\s<>"'\])]+/g;
const TRAILING = /[.,;:!?)]+$/;

/** Texto libre (notas de un centro) con las direcciones web convertidas en enlaces. */
export function Linkify({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const url = raw.replace(TRAILING, '');
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a key={start} href={url} target="_blank" rel="noopener noreferrer" className="break-all underline">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
