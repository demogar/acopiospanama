'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { Meta } from './account-types';

let cached: Meta | null = null;
let inflight: Promise<Meta> | null = null;

/** Catálogos de `GET /api/public/meta` (se piden una vez por carga de página). */
export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(cached);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (cached) return;
    inflight ??= api.get<Meta>('/public/meta');
    let alive = true;
    inflight
      .then((m) => {
        cached = m;
        if (alive) setMeta(m);
      })
      .catch((e) => {
        inflight = null;
        if (alive)
          setError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'No se pudieron cargar los catálogos.'));
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  return {
    meta,
    error,
    reload: () => {
      setError(null);
      setTick((t) => t + 1);
    },
  };
}
