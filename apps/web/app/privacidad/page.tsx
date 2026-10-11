import Link from 'next/link';
import { SiteFrame } from '@/components/site-frame';
import { Prose } from '@/components/public/prose';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Privacidad',
  description: 'Qué datos se publican, cuáles se guardan, por cuánto tiempo y cómo pedir que se borren.',
  path: '/privacidad',
});

/** Correo para solicitudes sobre datos (borrado, consultas). */
const CONTACT_EMAIL = 'acopiospanama@demogar.com';

export default function Privacidad() {
  return (
    <SiteFrame
      title="Privacidad"
      subtitle="Lo mínimo para que el directorio funcione, y nada más."
      back={{ href: '/', label: 'Inicio' }}
      width="prose"
    >
      <Prose>
        <section>
          <h2>Qué se publica</h2>
          <p>
            Solo los datos de los <strong>centros de acopio</strong>: nombre, quién lo organiza, lugar, dirección,
            horario, qué necesitan, notas y cuándo se confirmó por última vez.
          </p>
          <ul>
            <li>
              <strong>Los correos nunca se publican</strong>, ni el de quien publica ni el de quien administra.
            </li>
            <li>
              Un <strong>contacto</strong> (nombre, teléfono o WhatsApp) solo se publica si esa persona aceptó que se
              muestre. Se quita en cualquier momento editando el centro desde{' '}
              <Link href="/mis-centros">Mis centros</Link>, y deja de verse en menos de un minuto.
            </li>
          </ul>
        </section>

        <section>
          <h2>Qué se guarda</h2>
          <ul>
            <li>
              El <strong>correo</strong> (y el nombre, si lo pones) de quien publica o administra un centro, para que
              pueda entrar con un código y recibir avisos sobre su centro.
            </li>
            <li>
              Para contar confirmaciones y reportes sin contar dos veces a la misma persona, se guarda un{' '}
              <strong>identificador anónimo que cambia cada día</strong>, calculado a partir de la conexión.{' '}
              <strong>No guardamos direcciones IP.</strong>
            </li>
            <li>Los reportes guardan el motivo y los detalles que escribas, sin tu nombre ni tu correo.</li>
            <li>
              Un registro de cambios importantes (quién editó, cerró o moderó un centro) para poder revisar abusos.
            </li>
          </ul>
        </section>

        <section>
          <h2>Por cuánto tiempo</h2>
          <ul>
            <li>
              Correos que pidieron un código pero nunca entraron: <strong>1 día</strong>.
            </li>
            <li>
              Confirmaciones: <strong>30 días</strong>.
            </li>
            <li>
              Reportes: <strong>90 días</strong>.
            </li>
            <li>
              Centros cerrados o sin actividad: <strong>180 días</strong>, luego se borran.
            </li>
            <li>
              Registro de cambios: <strong>1 año</strong>.
            </li>
          </ul>
          <p>El borrado es automático, todos los días.</p>
        </section>

        <section>
          <h2>Tu ubicación</h2>
          <p>
            Si usas <strong>«Cerca de mí»</strong>, tu teléfono calcula las distancias.{' '}
            <strong>Tu ubicación nunca sale de tu teléfono</strong>: no se envía a nuestro servidor, no queda en el
            enlace y no se guarda.
          </p>
        </section>

        <section>
          <h2>Mapa y enlaces externos</h2>
          <p>
            El mapa es opcional y solo se carga si pulsas «Ver mapa». Sus imágenes vienen de OpenStreetMap, que recibe
            tu conexión como cualquier sitio web, pero no tu ubicación ni qué centro miras. Los botones «Cómo llegar»,
            «Waze» y «WhatsApp» abren esos servicios, con sus propias reglas de privacidad.
          </p>
        </section>

        <section>
          <h2>Cuánta gente usa el sitio</h2>
          <p>
            Para saber si el directorio sirve y qué páginas se consultan usamos una analítica propia,{' '}
            <a href="https://oss.medama.io" rel="noopener noreferrer">
              Medama
            </a>
            , de código abierto y en un servidor nuestro. Cuenta visitas por página <strong>sin cookies</strong> y sin
            identificadores personales; no se comparte con nadie ni sirve para publicidad. Si la bloqueas, el sitio
            funciona igual.
          </p>
          <p>
            No hay publicidad ni cookies de terceros. La única cookie es la de tu sesión, si entras para administrar un
            centro.
          </p>
        </section>

        <section>
          <h2>Cómo pedir que se borren tus datos</h2>
          <p>
            Escríbenos a <strong>{CONTACT_EMAIL}</strong> desde el correo que usaste y dinos qué quieres borrar. Si
            administras un centro, también puedes cerrarlo desde <Link href="/mis-centros">Mis centros</Link>.
          </p>
        </section>
      </Prose>
    </SiteFrame>
  );
}
