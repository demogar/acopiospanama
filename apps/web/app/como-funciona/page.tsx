import Link from 'next/link';
import { SiteFrame } from '@/components/site-frame';
import { Prose } from '@/components/public/prose';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Cómo funciona',
  description:
    'Cómo se mantiene al día el directorio de centros de acopio: confirmaciones, reportes y reglas automáticas.',
  path: '/como-funciona',
});

export default function ComoFunciona() {
  return (
    <SiteFrame
      title="Cómo funciona"
      subtitle="Un directorio que mantiene la comunidad, con reglas que se aplican solas."
      back={{ href: '/', label: 'Inicio' }}
      width="prose"
    >
      <Prose>
        <section>
          <h2>Para qué sirve</h2>
          <p>
            Para saber <strong>dónde llevar donaciones</strong> después del terremoto y{' '}
            <strong>qué necesitan hoy</strong> en cada centro de acopio de Panamá. No es un servicio del Gobierno ni
            atiende emergencias: para eso, llama al <a href="tel:911">911</a>.
          </p>
        </section>

        <section>
          <h2>Quién puede publicar</h2>
          <p>
            Cualquier persona que organice o conozca un centro: juntas comunales, iglesias, escuelas, fundaciones,
            empresas o grupos de vecinos. Solo necesitas tu correo para recibir un código. Quien publica queda como{' '}
            <strong>responsable</strong> y puede actualizar el centro desde <Link href="/mis-centros">Mis centros</Link>
            . Tu correo nunca se muestra.
          </p>
          <p>
            Para que el centro no dependa de una sola persona, el responsable puede invitar a{' '}
            <strong>co-responsables</strong>. La invitación llega por correo y solo da acceso cuando esa persona la{' '}
            <strong>acepta</strong> al entrar.
          </p>
          <p>
            Cada centro indica qué tipo de lugar es (acopio, distribución, comedor, albergue o mixto), su ubicación y su
            horario por día. Con ese horario se calcula si está <strong>abierto ahora</strong>, en hora de Panamá.
          </p>
          <p>
            Un <strong>contacto</strong> (nombre, teléfono o WhatsApp) solo se publica si esa persona lo acepta. Se
            puede quitar en cualquier momento editando el centro.
          </p>
          <p>
            <Link href="/publicar">Publicar un centro</Link>
          </p>
        </section>

        <section>
          <h2>Cómo se sabe si un centro sigue funcionando</h2>
          <ul>
            <li>
              Cada vez que el responsable confirma, o alguien que fue pulsa{' '}
              <strong>«Estuve aquí y sigue funcionando»</strong>, el centro se marca como confirmado en ese momento.
            </li>
            <li>
              Si pasan <strong>3 días</strong> sin que nadie lo confirme, aparece como{' '}
              <strong>«Sin confirmar recientemente»</strong> y baja en la lista.
            </li>
            <li>
              Si pasan <strong>14 días</strong> sin confirmación, deja de mostrarse.
            </li>
            <li>Cada persona cuenta una vez al día por centro, aunque pulse varias veces.</li>
          </ul>
        </section>

        <section>
          <h2>Qué pasa cuando alguien reporta un problema</h2>
          <ul>
            <li>
              Cualquiera puede reportar que un centro cerró, que ya no recibe, que tiene datos equivocados, que pide
              dinero, que parece falso, que se aprovechan y las donaciones no llegan a los afectados, o que publicaron
              sus datos sin permiso. El reporte es anónimo.
            </li>
            <li>
              La misma persona cuenta <strong>una sola vez</strong> por centro mientras su reporte siga abierto:
              reportar de nuevo otro día no suma.
            </li>
            <li>
              Si <strong>2 o más personas distintas</strong> lo reportan en 3 días, el centro muestra el aviso{' '}
              <strong>«Reportado: verifica antes de ir»</strong>.
            </li>
            <li>
              Si <strong>3 o más personas</strong> reportan algo grave (que cerró, que pide dinero, que es falso o que
              las donaciones no llegan a los afectados) y son más que quienes confirmaron que funciona, el centro{' '}
              <strong>se oculta</strong> solo.
            </li>
            <li>
              Un centro oculto <strong>vuelve a mostrarse</strong> si al menos tantas personas confirman que sigue
              funcionando como las que lo reportaron, o si su responsable lo confirma. En ese caso queda{' '}
              <strong>en disputa</strong>, con el aviso «Varias personas lo reportaron. Confirma por teléfono antes de
              ir y nunca envíes dinero».
            </li>
            <li>
              Si alguien reporta que publicaron <strong>sus datos sin permiso</strong>, el contacto del centro se oculta
              de inmediato.
            </li>
            <li>El responsable recibe un aviso por correo cuando su centro es reportado.</li>
          </ul>
        </section>

        <section>
          <h2>Aquí no se pide dinero</h2>
          <p>
            Las fichas solo pueden pedir <strong>artículos</strong>. El sistema bloquea textos con transferencias,
            números de cuenta o billeteras digitales. Tampoco admiten <strong>enlaces</strong> a otros sitios.{' '}
            <strong>Nunca transfieras dinero a nombre de un centro de esta lista.</strong> Si ves que alguno pide
            dinero, repórtalo. Si quieres donar dinero, hazlo directamente a organizaciones reconocidas.
          </p>
        </section>

        <section id="juega-vivo">
          <h2>Cómo evitar el «juega vivo»</h2>
          <p>
            En cada emergencia aparece gente que se aprovecha de la buena voluntad de los demás. Este directorio no
            puede comprobar cada centro en persona, pero sí te da señales para decidir, y una regla simple:{' '}
            <strong>usa siempre canales verificados</strong>.
          </p>
          <ul>
            <li>
              <strong>Canales verificados.</strong> Instituciones del Estado, municipios, juntas comunales, Cruz Roja,
              iglesias, escuelas y fundaciones con nombre. Si no hay una organización reconocible detrás, pregunta quién
              responde por el centro.
            </li>
            <li>
              <strong>Cuándo se confirmó y por cuántas personas.</strong> Un centro con confirmaciones recientes de
              varias personas es un centro que existe y funciona.
            </li>
            <li>
              <strong>Nunca dinero.</strong> Si te piden dinero, transferencias o Yappy en nombre de un centro de esta
              lista, no lo des y repórtalo. Si quieres donar dinero, hazlo directamente a organizaciones reconocidas.
            </li>
            <li>
              <strong>Entrega en mano.</strong> Lleva tú la donación al centro y pide que la reciban allí. No la
              entregues a intermediarios que «pasan a buscarla» ni a cuentas personales en redes.
            </li>
            <li>
              <strong>Reporta lo que veas.</strong> Si sospechas que alguien se está quedando con las donaciones,
              repórtalo desde la ficha: con varios reportes de personas distintas el centro se oculta solo.
            </li>
          </ul>
        </section>

        <section>
          <h2>Moderación</h2>
          <p>
            Las reglas automáticas hacen casi todo el trabajo. Un pequeño equipo de moderación interviene solo como
            último recurso, por ejemplo ante una estafa evidente.
          </p>
        </section>

        <section>
          <h2>Antes de ir</h2>
          <ul>
            <li>Mira cuándo se confirmó por última vez y si tiene avisos.</li>
            <li>Si hay teléfono, llama. Lleva lo que aparece como «Urgente» y evita lo que dice «Ya no necesitan».</li>
            <li>Si fuiste y sigue funcionando, confírmalo: ayudas a la siguiente persona.</li>
          </ul>
        </section>

        <p className="text-sm text-ink-2">
          Más detalles sobre tus datos en <Link href="/privacidad">Privacidad</Link>.
        </p>
      </Prose>
    </SiteFrame>
  );
}
