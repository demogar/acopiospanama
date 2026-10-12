-- Centros temporales: días en que reciben donaciones (hora de Panamá; el último día cuenta entero).
-- Si ambas fechas son NULL el centro es permanente, hasta nuevo aviso. Pasado available_until, el centro
-- sale del directorio (visibilidad ENDED) sin cerrarse: su responsable lo reabre poniendo fechas nuevas.
ALTER TABLE centers
  ADD COLUMN available_from date,
  ADD COLUMN available_until date,
  ADD CONSTRAINT centers_available_order CHECK (
    available_from IS NULL OR available_until IS NULL OR available_from <= available_until
  );

-- Centros ya publicados cuya fuente dice en qué días reciben (texto de su horario entre comillas).
-- Solo los que tienen un final claro: «desde el lunes 12», sin fecha de cierre, sigue como permanente.
-- Por slug, porque los ids cambian entre entornos; en una base sin ese centro no hace nada.
UPDATE centers SET available_from = '2026-10-10', available_until = '2026-10-12' WHERE slug = 'camerino-by-alex-olivero-bella-vista'; -- «sábado 10 y lunes 12»
UPDATE centers SET available_from = '2026-10-11', available_until = '2026-10-11' WHERE slug = 'punto-de-carga-frente-a-novey-centennial-ancon-centennial'; -- «solo el domingo 11»
UPDATE centers SET available_from = '2026-10-13', available_until = '2026-10-15' WHERE slug = 'tic-tac-toe-kids-bella-vista'; -- «del martes 13 al jueves 15»
UPDATE centers SET available_from = '2026-10-13', available_until = '2026-10-13' WHERE slug = 'universidad-americana-de-panama-uam-bienestar-estudiantil-ju'; -- «martes 13»
UPDATE centers SET available_from = '2026-10-13', available_until = '2026-10-13' WHERE slug = 'centro-infantil-creates-kids-panama-perejil'; -- «martes 13»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-12' WHERE slug = 'umip-direccion-de-recursos-humanos-la-boca'; -- «lunes 12»
UPDATE centers SET available_from = '2026-10-11', available_until = '2026-10-13' WHERE slug = 'centro-de-acopio-universidad-de-panama-campus-harmodio-arias'; -- «domingo 11 a martes 13»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-12' WHERE slug = 'plaza-ondgo-parque-de-nino-barriada-paraiso'; -- «lunes 12»
UPDATE centers SET available_from = '2026-10-11', available_until = '2026-10-12' WHERE slug = 'twins-west-workshop-la-chorrera'; -- «hoy (11) y mañana (12)»
UPDATE centers SET available_from = '2026-10-13', available_until = '2026-10-14' WHERE slug = 'colegio-pureza-de-maria-panama-san-miguelito'; -- «13 y 14»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-12' WHERE slug = 'frente-al-centro-educativo-jose-e-escala-santa-rita'; -- «lunes 12»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-12' WHERE slug = 'edificio-solendeg-bella-vista'; -- «lunes 12»
UPDATE centers SET available_from = '2026-10-14', available_until = '2026-10-15' WHERE slug = 'colegio-san-vicente-de-panama-los-rios'; -- «miércoles 14 y jueves 15»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-16' WHERE slug = 'hyatt-regency-panama-city-bella-vista'; -- «del lunes 12 al viernes 16»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-14' WHERE slug = 'suntracs-proyectos-parque-lefevre'; -- «del 12 al 14»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-12' WHERE slug = 'entrada-de-tvn-condado-del-rey-ii'; -- «lunes 12»
UPDATE centers SET available_from = NULL, available_until = '2026-10-16' WHERE slug = 'administracion-del-colegio-javier-panama'; -- «hasta el 16»
UPDATE centers SET available_from = NULL, available_until = '2026-10-14' WHERE slug = 'centerfit-panama-san-francisco'; -- «hasta el miércoles 14»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-16' WHERE slug = 'restaurante-corotu-la-chorrera'; -- «del 12 al 16»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-12' WHERE slug = 'centro-de-acopio-parque-sergio-gonzalez-ruiz-las-tablas'; -- «lunes 12»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-13' WHERE slug = 'centro-de-acopio-universidad-de-panama-panama'; -- «solo lunes 12 y martes 13»
UPDATE centers SET available_from = NULL, available_until = '2026-10-13' WHERE slug = 'deconos-contenedor-plaza-cerro-viento-rufina-alfaro'; -- «hasta el martes 13»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-16' WHERE slug = 'parroquia-nuestra-senora-del-carmen-juan-diaz-juan-diaz'; -- «del lunes 12 al viernes 16»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-16' WHERE slug = 'parroquia-inmaculada-concepcion-la-chorrera-altos-de-san-fra'; -- «del lunes 12 al viernes 16»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-16' WHERE slug = 'arzobispado-de-panama-caritas-arquidiocesana-san-francisco'; -- «del lunes 12 al viernes 16»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-15' WHERE slug = 'centro-de-acopio-afutpa-ciudad-de-panama'; -- «del 12 al 15»
UPDATE centers SET available_from = '2026-10-10', available_until = '2026-10-11' WHERE slug = 'parque-libertador-la-chorrera'; -- «sábado 10 y domingo 11»
UPDATE centers SET available_from = '2026-10-11', available_until = '2026-10-11' WHERE slug = 'parque-metropolitano-de-david-pameda-david'; -- «este domingo 11»
UPDATE centers SET available_from = '2026-10-10', available_until = '2026-10-10' WHERE slug = 'super-99-de-villa-lucre-alcaldia-de-san-miguelito-jose-domin'; -- «sábado 10»
UPDATE centers SET available_from = '2026-10-10', available_until = '2026-10-13' WHERE slug = 'club-de-leones-de-chanis-plaza-agora-chanis'; -- «recibieron 10 y 11; la carga sale el 12 o 13»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-13' WHERE slug = 'apede-sede-central-calidonia'; -- «lunes 12 y martes 13»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-13' WHERE slug = 'apede-azuero-chitre-san-juan-bautista'; -- «solo lunes 12 y martes 13»
UPDATE centers SET available_from = '2026-10-12', available_until = '2026-10-14' WHERE slug = 'gimnasio-de-la-usma-bethania'; -- «del lunes 12 al miércoles 14»
UPDATE centers SET available_from = '2026-10-10', available_until = '2026-10-17' WHERE slug = 'iglesia-casa-de-vida-internacional-el-vedado'; -- «del 10 al 17»
UPDATE centers SET available_from = '2026-10-10', available_until = '2026-10-12' WHERE slug = 'farmacias-revilla-sucursal-terronal-terronal'; -- «del sábado 10 al lunes 12»
