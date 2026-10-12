'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  DialogClose,
  DialogContent,
  type DialogContentProps,
  DrawerClose,
  DrawerContent,
  type DrawerContentProps,
  IconButton,
} from '@demogar/mola-ui';

/*
 * Envoltorios de DialogContent y DrawerContent de mola-ui con el botón de cerrar en español.
 * El botón de mola-ui trae la etiqueta fija «Close»; aquí lo ocultamos (`hideClose`) y ponemos uno
 * propio de 48 px con la etiqueta «Cerrar», usando el `Close` del primitivo (Escape, clic y teclado
 * funcionan igual). Va en posición absoluta respecto al panel, así no se desplaza con el contenido;
 * el título deja sitio a la derecha.
 *
 * Devolución del foco: Base UI solo devuelve el foco al cerrar cuando el diálogo tiene un
 * DialogTrigger. En esta app casi todos se abren con estado o se montan de forma condicional, y el
 * foco acababa en <body>. `OpenerMemo` se monta solo mientras el panel está abierto: en su primer
 * render (antes de que el foco entre al panel) guarda el elemento que tenía el foco, y se usa como
 * `finalFocus`, o se enfoca al desmontar si el diálogo desaparece del árbol sin animación de cierre.
 */

type OpenerRef = { current: HTMLElement | null };

function OpenerMemo({ openerRef }: { openerRef: OpenerRef }) {
  // El inicializador corre en el primer render, antes de que el foco entre al panel.
  const [opener] = useState(() => {
    const a = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    return a && a !== document.body ? a : null;
  });
  useEffect(() => {
    openerRef.current = opener;
    return () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (opener?.isConnected && (!active || active === document.body || !active.isConnected)) opener.focus();
      });
    };
  }, [openerRef, opener]);
  return null;
}

function useOpener() {
  const openerRef = useRef<HTMLElement | null>(null);
  const finalFocus = () => (openerRef.current?.isConnected ? openerRef.current : true);
  return { openerRef, finalFocus };
}

const closeClass = 'absolute end-2 top-[calc(11px+0.5rem)] z-10';

export function DialogContentEs({ title, children, hideClose = false, finalFocus, ...props }: DialogContentProps) {
  const o = useOpener();
  return (
    <DialogContent
      {...props}
      finalFocus={finalFocus ?? o.finalFocus}
      hideClose
      title={<span className="block pe-12">{title}</span>}
    >
      <OpenerMemo openerRef={o.openerRef} />
      {!hideClose && (
        <DialogClose
          render={
            <IconButton label="Cerrar" variant="ghost" className={closeClass}>
              <X />
            </IconButton>
          }
        />
      )}
      {children}
    </DialogContent>
  );
}

export function DrawerContentEs({ title, children, hideClose = false, finalFocus, ...props }: DrawerContentProps) {
  const o = useOpener();
  return (
    <DrawerContent
      {...props}
      finalFocus={finalFocus ?? o.finalFocus}
      hideClose
      title={<span className="block pe-12">{title}</span>}
    >
      <OpenerMemo openerRef={o.openerRef} />
      {!hideClose && (
        <DrawerClose
          render={
            <IconButton label="Cerrar" variant="ghost" className={closeClass}>
              <X />
            </IconButton>
          }
        />
      )}
      {children}
    </DrawerContent>
  );
}
