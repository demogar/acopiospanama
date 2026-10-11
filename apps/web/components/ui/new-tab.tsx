/**
 * Aviso solo para lectores de pantalla en los enlaces que abren otra pestaña o aplicación
 * (Google Maps, Waze, WhatsApp): con él, quien navega con el teclado o un lector sabe que va
 * a salir del sitio antes de activar el enlace.
 *
 *   <a href={…} target="_blank" rel="noopener noreferrer">Waze<NewTab /></a>
 */
export function NewTab({ label = 'se abre en otra pestaña' }: { label?: string }) {
  return <span className="sr-only"> ({label})</span>;
}
