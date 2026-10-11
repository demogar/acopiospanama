'use client';

import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, Select } from '@demogar/mola-ui';
import type { Destination, Meta } from '@/lib/account-types';

export const MAX_DESTINATIONS = 10;

/**
 * A dónde llega la ayuda: una fila por destino (provincia del catálogo + distrito o comunidad en texto).
 * Pensado para el pulgar: cada fila cabe en 375 px y «Quitar» tiene 44 px de alto.
 */
export function DestinationsEditor({
  meta,
  value,
  onChange,
  errors = {},
}: {
  meta: Meta;
  value: Destination[];
  onChange: (next: Destination[]) => void;
  /** Errores por fila: `destinations.<i>.province` y `destinations.<i>.district`. */
  errors?: Record<string, string>;
}) {
  const update = (i: number, patch: Partial<Destination>) =>
    onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const add = () => onChange([...value, { province: '', district: '' }]);

  return (
    <div className="grid gap-3">
      {value.length === 0 && (
        <p className="text-sm text-ink-2">
          Aún no indicaste ningún destino. Quien dona busca centros que lleven la ayuda a un lugar concreto.
        </p>
      )}
      {value.length > 0 && (
        <ol className="grid gap-3">
          {value.map((d, i) => (
            <DestinationRow
              key={i}
              index={i}
              meta={meta}
              value={d}
              provinceError={errors[`destinations.${i}.province`]}
              districtError={errors[`destinations.${i}.district`]}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </ol>
      )}
      {value.length < MAX_DESTINATIONS && (
        <div>
          <Button type="button" variant="secondary" icon={<Plus aria-hidden="true" />} onClick={add}>
            {value.length === 0 ? 'Añadir destino' : 'Añadir otro destino'}
          </Button>
        </div>
      )}
    </div>
  );
}

function DestinationRow({
  index,
  meta,
  value,
  provinceError,
  districtError,
  onChange,
  onRemove,
}: {
  index: number;
  meta: Meta;
  value: Destination;
  provinceError?: string;
  districtError?: string;
  onChange: (patch: Partial<Destination>) => void;
  onRemove: () => void;
}) {
  const listId = useId();
  const districts = value.province ? (meta.districts[value.province] ?? []) : [];
  return (
    <li className="grid gap-2 bg-cloth-pale p-3 shadow-cut" data-destination={index}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={`Destino ${index + 1}: provincia o comarca`} error={provinceError} required>
          {(c) => (
            <Select
              {...c}
              placeholder="Elige la provincia o comarca"
              items={Object.entries(meta.provinces).map(([v, l]) => ({ value: v, label: l }))}
              value={value.province || null}
              onValueChange={(v) => onChange({ province: v ?? '' })}
            />
          )}
        </Field>
        <Field
          label="Distrito o comunidad (opcional)"
          hint={districts.length ? 'Escribe o elige de la lista.' : undefined}
          error={districtError}
        >
          {(c) => (
            <Input
              {...c}
              list={districts.length ? listId : undefined}
              value={value.district}
              maxLength={60}
              autoComplete="off"
              placeholder="Ej.: Macaracas"
              onChange={(e) => onChange({ district: e.target.value })}
            />
          )}
        </Field>
        {districts.length > 0 && (
          <datalist id={listId}>
            {districts.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        )}
      </div>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          icon={<X aria-hidden="true" />}
          onClick={onRemove}
        >
          Quitar <span className="sr-only">el destino {index + 1}</span>
        </Button>
      </div>
    </li>
  );
}
