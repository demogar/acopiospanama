'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

/** Carga datos de la API con estados de carga/error y `reload()`. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);

  // Al cambiar la ruta o pedir `reload()`, pasa a «cargando» en el mismo render (no en el efecto).
  const [prev, setPrev] = useState({ path, tick });
  if (prev.path !== path || prev.tick !== tick) {
    setPrev({ path, tick });
    if (path) setLoading(true);
  }

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    api
      .get<T>(path, { signal: ctrl.signal })
      .then((d) => {
        // Una respuesta que llega tras cambiar de ruta ya no vale.
        if (ctrl.signal.aborted) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return;
        setError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Ocurrió un error inesperado.'));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
