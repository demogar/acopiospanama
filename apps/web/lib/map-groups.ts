/**
 * Agrupa los puntos del mapa que en pantalla quedarían encimados. Trabaja en píxeles del nivel de zoom
 * actual: al acercar, los grupos se separan solos. `gap` es la distancia mínima entre centros de
 * marcadores (el área táctil de 44 px más un margen).
 */
export function groupMapPoints<T extends { x: number; y: number }>(points: readonly T[], gap = 48): T[][] {
  const groups: { points: T[]; x: number; y: number }[] = [];
  for (const p of points) groups.push({ points: [p], x: p.x, y: p.y });
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i];
        const b = groups[j];
        if (Math.abs(a.x - b.x) > gap || Math.abs(a.y - b.y) > gap) continue;
        // El grupo se dibuja en el centro de sus puntos: al crecer puede alcanzar a otro, por eso se repite.
        const n = a.points.length + b.points.length;
        a.x = (a.x * a.points.length + b.x * b.points.length) / n;
        a.y = (a.y * a.points.length + b.y * b.points.length) / n;
        a.points.push(...b.points);
        groups.splice(j, 1);
        j--;
        merged = true;
      }
    }
  }
  return groups.map((g) => g.points);
}
