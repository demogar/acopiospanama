'use client';

import { useEffect } from 'react';
import { ToastProvider } from '@demogar/mola-ui';

/** Prefijos solo para lectores de pantalla que mola-ui pone en inglés en el título de los Toast. */
const SR_PREFIX: Record<string, string> = {
  'Success: ': 'Listo: ',
  'Error: ': 'Error: ',
  'In progress: ': 'En curso: ',
};

/**
 * mola-ui fija textos accesibles en inglés: «Dismiss» como nombre del botón de cerrar de los avisos (Toast y
 * Callout) y «Success: »/«In progress: » como prefijo oculto del título del Toast, y no permite cambiarlos.
 * Los traducimos en el DOM hasta que la librería acepte etiquetas.
 */
function useSpanishDismissLabels() {
  useEffect(() => {
    const fix = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>('[aria-label="Dismiss"], [title="Dismiss"]')) {
        if (el.getAttribute('aria-label') === 'Dismiss') el.setAttribute('aria-label', 'Cerrar aviso');
        if (el.getAttribute('title') === 'Dismiss') el.setAttribute('title', 'Cerrar aviso');
      }
      for (const el of root.querySelectorAll<HTMLElement>('.sr-only')) {
        const es = el.textContent ? SR_PREFIX[el.textContent] : undefined;
        if (es && es !== el.textContent && el.childElementCount === 0) el.textContent = es;
      }
    };
    fix(document);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') fix(r.target.parentNode ?? document);
        for (const n of r.addedNodes) if (n instanceof Element) fix(n.parentNode ?? n);
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title'],
    });
    return () => obs.disconnect();
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useSpanishDismissLabels();
  return <ToastProvider>{children}</ToastProvider>;
}
