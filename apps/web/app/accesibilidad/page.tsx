import Link from 'next/link';
import { SiteFrame } from '@/components/site-frame';
import { Prose } from '@/components/public/prose';
import { NewTab } from '@/components/ui/new-tab';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Accesibilidad',
  description:
    'Cómo está hecho Acopio Panamá para usarse con teclado, lector de pantalla, zoom o alto contraste, qué falta y cómo avisarnos.',
  path: '/accesibilidad',
});

/** Correo para avisar de problemas de accesibilidad (el mismo que en Privacidad). */
const CONTACT_EMAIL = 'acopiospanama@demogar.com';
const ISSUES_URL = 'https://github.com/demogar/acopiospanama/issues';
/** Fecha de la última revisión completa (manual y automática). Actualízala al volver a revisar. */
const LAST_REVIEW = '11 de octubre de 2026';

export default function Accesibilidad() {
  return (
    <SiteFrame
      title="Accesibilidad"
      subtitle="Un directorio de emergencia tiene que servirle a todo el mundo, desde cualquier teléfono."
      back={{ href: '/', label: 'Inicio' }}
      width="prose"
    >
      <Prose>
        <section>
          <h2>Nuestro compromiso</h2>
          <p>
            Acopio Panamá se construye para que cualquier persona pueda encontrar dónde llevar donaciones, también quien
            usa un <strong>lector de pantalla</strong>, navega <strong>solo con el teclado</strong>, necesita{' '}
            <strong>letra grande</strong> o <strong>alto contraste</strong>, o tiene poca señal y un teléfono viejo. La
            meta es cumplir las <strong>Pautas de Accesibilidad para el Contenido Web (WCAG) 2.2, nivel AA</strong>.
          </p>
          <p>
            La accesibilidad se revisa con cada cambio importante del sitio, con pruebas automáticas y a mano. Última
            revisión completa: <strong>{LAST_REVIEW}</strong>.
          </p>
        </section>

        <section id="como-esta-hecho">
          <h2>Cómo está hecho</h2>
          <ul>
            <li>
              <strong>Teclado.</strong> Todo se puede usar con Tab, Mayús+Tab, Enter, Espacio y las flechas. El elemento
              con el foco siempre se marca con un borde visible. El primer enlace de cada página, «Saltar al contenido»,
              lleva directo a lo importante.
            </li>
            <li>
              <strong>Lectores de pantalla.</strong> Las páginas están en español (<code>es-PA</code>), con regiones
              (cabecera, contenido, navegación, pie), encabezados en orden y etiquetas en todos los controles. Los
              cambios que ocurren sin recargar, como el número de resultados al filtrar o el envío de un reporte, se
              anuncian.
            </li>
            <li>
              <strong>Contraste y color.</strong> Los textos tienen un contraste de al menos 4,5:1 sobre su fondo. Nada
              se indica solo con color: «Urgente», «Abierto ahora» o «Sin confirmar recientemente» van siempre en
              palabras.
            </li>
            <li>
              <strong>Tamaño para el pulgar.</strong> Botones, enlaces de acción y filtros miden al menos 44 píxeles de
              alto, pensados para tocarlos en la calle y con prisa.
            </li>
            <li>
              <strong>Zoom y letra grande.</strong> Puedes ampliar hasta un 200 % o más sin perder contenido ni tener
              que desplazarte de lado. El sitio respeta el tamaño de letra que configures en tu teléfono.
            </li>
            <li>
              <strong>Sin prisa ni sobresaltos.</strong> No hay límites de tiempo para leer o llenar un formulario (solo
              los códigos de acceso por correo vencen, a los 10 minutos, y se pueden pedir de nuevo). No hay animaciones
              automáticas, y si tu sistema pide «reducir el movimiento», se quitan las pocas transiciones.
            </li>
            <li>
              <strong>Formularios claros.</strong> Cada campo tiene su nombre y una ayuda. Si falta algo, el error se
              lee junto al campo y en un resumen arriba que enlaza a lo que hay que corregir.
            </li>
            <li>
              <strong>Alto contraste de Windows.</strong> Bordes, botones y la opción marcada en los filtros se
              mantienen visibles con los colores del sistema.
            </li>
            <li>
              <strong>El mapa es opcional.</strong> Solo se carga si pulsas «Ver mapa». Todo lo que muestra está también
              en la lista de centros, que es la vía principal.
            </li>
            <li>
              <strong>Lenguaje claro.</strong> Textos cortos, en el español de Panamá, sin tecnicismos. Los enlaces que
              abren otra aplicación (Google Maps, Waze, WhatsApp) lo avisan a los lectores de pantalla.
            </li>
          </ul>
        </section>

        <section id="consejos">
          <h2>Consejos de uso</h2>
          <ul>
            <li>
              En el inicio, los artículos («¿Qué quieres donar?») son botones que se activan y desactivan; las
              provincias se eligen con las flechas, como una lista de opciones.
            </li>
            <li>
              Los diálogos (reportar un problema, confirmar que un centro cerró) se cierran con <kbd>Esc</kbd> y
              devuelven el foco al botón que los abrió.
            </li>
            <li>
              «Cerca de mí» es opcional y usa la ubicación de tu teléfono sin enviarla a ningún servidor. Si no la das,
              filtra por provincia o busca tu distrito.
            </li>
            <li>
              Si la letra te resulta pequeña, usa el zoom del navegador o el modo de lectura: el contenido se adapta.
            </li>
          </ul>
        </section>

        <section id="limitaciones">
          <h2>Lo que todavía no está resuelto</h2>
          <ul>
            <li>
              Los puntos del <strong>mapa</strong> no se pueden recorrer con el teclado ni con un lector de pantalla. La
              misma información (nombre, qué necesitan, si está abierto) está en la lista y en la ficha de cada centro.
            </li>
            <li>
              Al pulsar «Cómo llegar», «Waze» o «WhatsApp» pasas a <strong>servicios de otras empresas</strong>, con su
              propia accesibilidad.
            </li>
            <li>
              Los nombres, direcciones y notas de los centros <strong>los escribe la comunidad</strong>. Pueden traer
              abreviaturas o mayúsculas que un lector de pantalla lea raro. Si ves uno confuso, repórtalo desde la
              ficha.
            </li>
            <li>
              El sitio se muestra siempre con <strong>fondo claro</strong>, porque se lee mejor bajo el sol y en
              pantallas baratas; por ahora no hay modo oscuro.
            </li>
            <li>
              Algunas pantallas, como la de un centro que ya no existe, necesitan <strong>JavaScript</strong> para
              mostrar su contenido.
            </li>
          </ul>
        </section>

        <section id="como-se-evaluo">
          <h2>Cómo se evaluó</h2>
          <p>
            Revisión manual del código y de cada pantalla con teclado y lector de pantalla, más pruebas automáticas con{' '}
            <a href="https://github.com/dequelabs/axe-core" rel="noopener noreferrer">
              axe-core
            </a>{' '}
            (reglas WCAG 2.2 AA) en un teléfono estrecho (400 píxeles) y en escritorio, incluyendo el mapa, los filtros
            y los diálogos. El código es abierto: cualquiera puede repetir la revisión.
          </p>
        </section>

        <section id="avisar">
          <h2>Si algo no te funciona, cuéntanos</h2>
          <p>
            Escríbenos a <strong>{CONTACT_EMAIL}</strong> o abre un aviso en{' '}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              GitHub
              <NewTab />
            </a>
            . Dinos qué página, qué intentabas hacer y con qué ayuda técnica o navegador. Lo arreglamos lo antes
            posible; en una emergencia, primero.
          </p>
        </section>

        <p className="text-sm text-ink-2">
          Ver también <Link href="/como-funciona">Cómo funciona</Link> y <Link href="/privacidad">Privacidad</Link>.
        </p>
      </Prose>
    </SiteFrame>
  );
}
