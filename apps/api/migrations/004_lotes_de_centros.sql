-- Lotes de centros (data/centros/NNN_*.json) ya cargados. Funcionan como las migraciones: cada lote se
-- importa una sola vez, al arrancar la API tras un despliegue (cli `import-batches`).
CREATE TABLE center_batches (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Los cinco primeros lotes se cargaron a mano antes de existir esta tabla. Si la base ya tiene centros
-- (producción), se dan por aplicados para no volver a crear los que alguien renombró o retiró.
-- En una base nueva no se marca nada y se cargan todos.
INSERT INTO center_batches (name)
SELECT unnest(ARRAY[
  '001_prensa-y-redes.json',
  '002_segundo-lote.json',
  '003_tercer-lote.json',
  '004_cuarto-lote.json',
  '005_quinto-lote.json'
])
WHERE EXISTS (SELECT 1 FROM centers);
