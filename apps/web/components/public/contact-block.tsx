import { MessageCircle, Phone } from 'lucide-react';
import { buttonVariants } from '@demogar/mola-ui';
import { NewTab } from '@/components/ui/new-tab';
import { telLink, whatsappLink } from '@/lib/public-schedule';
import type { PublicCenter } from '@/lib/public-types';

const btn = 'no-underline w-full sm:w-auto h-auto! min-h-11 whitespace-normal! py-2 text-center leading-snug';

/** Contacto público (solo existe si esa persona aceptó publicarlo). Sin datos, no se muestra. */
export function ContactBlock({
  center,
}: {
  center: Pick<PublicCenter, 'name' | 'contactName' | 'contactPhone' | 'contactWhatsapp'>;
}) {
  const wa = center.contactWhatsapp
    ? whatsappLink(
        center.contactWhatsapp,
        `Hola${center.contactName ? ` ${center.contactName}` : ''}, te escribo por «${center.name}», que vi en Acopio Panamá. ¿Siguen recibiendo donaciones hoy?`,
      )
    : null;
  if (!center.contactName && !center.contactPhone && !wa) return null;
  return (
    <section aria-labelledby="contacto" className="grid gap-3">
      <h2 id="contacto" className="font-ui text-xl font-bold">
        Contacto
      </h2>
      {center.contactName && <p>{center.contactName}</p>}
      {(center.contactPhone || wa) && (
        <div className="flex flex-wrap gap-2">
          {center.contactPhone && (
            <a href={telLink(center.contactPhone)} className={`${buttonVariants({ variant: 'secondary' })} ${btn}`}>
              <Phone aria-hidden="true" className="size-4" />
              Llamar · {center.contactPhone}
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonVariants({ variant: 'secondary' })} ${btn}`}
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              Escribir por WhatsApp
              <NewTab label="se abre en WhatsApp" />
            </a>
          )}
        </div>
      )}
      <p className="text-sm text-ink-2">
        Publicado con el permiso de esa persona. Escribe solo para coordinar donaciones.
      </p>
    </section>
  );
}
