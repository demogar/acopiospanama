'use client';

import { useId } from 'react';
import { Checkbox, Field, Input, Select, Stack, Textarea } from '@demogar/mola-ui';
import { type CenterInput, centerTypes, type Meta } from '@/lib/account-types';
import { DAYS, type Day } from '@/lib/public-schedule';
import { LocationField } from './location-field';
import { ScheduleEditor, scheduleErrors } from './schedule-editor';

/** Etiquetas de los campos (resumen de errores). */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre del centro',
  centerType: 'Tipo de centro',
  organizerType: 'Quién lo organiza',
  organizerName: 'Nombre de quien organiza',
  province: 'Provincia o comarca',
  district: 'Distrito',
  community: 'Comunidad',
  address: 'Dirección o referencia',
  lat: 'Ubicación exacta',
  lng: 'Ubicación exacta',
  schedule: 'Horario',
  hoursNote: 'Nota sobre el horario',
  contactName: 'Nombre de contacto',
  contactPhone: 'Teléfono de contacto',
  contactWhatsapp: 'WhatsApp',
  contactConsent: 'Permiso para publicar el contacto',
  notes: 'Notas',
};

export function fieldLabel(k: string): string {
  return FIELD_LABELS[k] ?? FIELD_LABELS[k.split('.')[0]] ?? (k.startsWith('needs') ? 'Qué aceptan' : 'Formulario');
}

/** Lleva el foco al primer control del campo `name` (para el resumen de errores). */
export function focusField(root: HTMLElement | null, name: string) {
  const base = name === 'lng' ? 'lat' : name.split('.')[0];
  const box = root?.querySelector<HTMLElement>(`[data-field="${base}"]`);
  const el = box?.querySelector<HTMLElement>(
    'input:not([type=hidden]):not(.sr-only), textarea, button, [tabindex]:not([tabindex="-1"])',
  );
  box?.scrollIntoView({ block: 'center' });
  el?.focus({ preventScroll: true });
}

const hasContact = (v: CenterInput) => !!(v.contactName.trim() || v.contactPhone.trim() || v.contactWhatsapp.trim());

/** Datos de la ficha. Controlado: el padre guarda el valor y los errores por campo. */
export function CenterFields({
  meta,
  value,
  onChange,
  errors,
  tileHost,
}: {
  meta: Meta;
  value: CenterInput;
  onChange: (patch: Partial<CenterInput>) => void;
  errors: Record<string, string>;
  tileHost: string;
}) {
  const listId = useId();
  const districts = value.province ? (meta.districts[value.province] ?? []) : [];
  const sameWa = !!value.contactPhone.trim() && value.contactWhatsapp.trim() === value.contactPhone.trim();

  // Errores del horario: los locales y los de la API (`schedule.MON`, `schedule.MON.open`…).
  const dayErrs: Partial<Record<Day, string>> = {};
  for (const [k, msg] of Object.entries(errors)) {
    const d = k.split('.')[1] as Day | undefined;
    if (k.startsWith('schedule.') && d && DAYS.includes(d)) dayErrs[d] ??= msg;
  }

  return (
    <Stack gap="lg">
      <Field
        data-field="name"
        label="Nombre del centro"
        hint="Como lo conoce la gente. Ej.: Acopio Junta Comunal de Tonosí"
        error={errors.name}
        required
      >
        {(c) => (
          <Input {...c} value={value.name} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} />
        )}
      </Field>

      <Field data-field="centerType" label="Tipo de centro" error={errors.centerType} required>
        {(c) => (
          <Select
            {...c}
            placeholder="Elige el tipo"
            items={Object.entries(centerTypes(meta)).map(([v, l]) => ({ value: v, label: l }))}
            value={value.centerType || null}
            onValueChange={(v) => onChange({ centerType: v ?? '' })}
          />
        )}
      </Field>

      <fieldset className="min-w-0">
        <legend className="mb-2 font-semibold text-ink">Quién lo organiza</legend>
        <Stack gap="md">
          <Field data-field="organizerType" label="Tipo de organización" error={errors.organizerType} required>
            {(c) => (
              <Select
                {...c}
                placeholder="Elige una opción"
                items={Object.entries(meta.organizerTypes).map(([v, l]) => ({ value: v, label: l }))}
                value={value.organizerType || null}
                onValueChange={(v) => onChange({ organizerType: v ?? '' })}
              />
            )}
          </Field>
          <Field
            data-field="organizerName"
            label="Nombre (opcional)"
            hint="Ej.: Parroquia San Juan, Club de Leones de Las Tablas"
            error={errors.organizerName}
          >
            {(c) => (
              <Input
                {...c}
                value={value.organizerName}
                maxLength={120}
                onChange={(e) => onChange({ organizerName: e.target.value })}
              />
            )}
          </Field>
        </Stack>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="mb-2 font-semibold text-ink">Dónde está</legend>
        <Stack gap="md">
          <Field data-field="province" label="Provincia o comarca" error={errors.province} required>
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
            data-field="district"
            label="Distrito (opcional)"
            hint={districts.length ? 'Escribe o elige de la lista.' : undefined}
            error={errors.district}
          >
            {(c) => (
              <Input
                {...c}
                list={districts.length ? listId : undefined}
                value={value.district}
                maxLength={60}
                autoComplete="off"
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
          <Field data-field="community" label="Comunidad, barrio o corregimiento (opcional)" error={errors.community}>
            {(c) => (
              <Input
                {...c}
                value={value.community}
                maxLength={80}
                onChange={(e) => onChange({ community: e.target.value })}
              />
            )}
          </Field>
          <Field
            data-field="address"
            label="Dirección o referencia"
            hint="Cómo llegar. Ej.: frente al parque, al lado de la iglesia"
            error={errors.address}
            required
          >
            {(c) => (
              <Textarea
                {...c}
                rows={2}
                autosize
                value={value.address}
                maxLength={300}
                onChange={(e) => onChange({ address: e.target.value })}
              />
            )}
          </Field>
          <div data-field="lat">
            <LocationField
              lat={value.lat}
              lng={value.lng}
              tileHost={tileHost}
              error={errors.lat ?? errors.lng}
              onChange={(lat, lng) => onChange({ lat, lng })}
            />
          </div>
        </Stack>
      </fieldset>

      <fieldset className="min-w-0" data-field="schedule">
        <legend className="mb-2 font-semibold text-ink">Horario (opcional)</legend>
        <ScheduleEditor
          value={value.schedule}
          onChange={(schedule) => onChange({ schedule })}
          errors={dayErrs}
          apiError={errors.schedule}
        />
      </fieldset>

      <Field
        data-field="hoursNote"
        label="Nota sobre el horario (opcional)"
        hint="Ej.: hasta agotar espacio; el sábado solo reciben agua."
        error={errors.hoursNote}
      >
        {(c) => (
          <Input
            {...c}
            value={value.hoursNote}
            maxLength={200}
            onChange={(e) => onChange({ hoursNote: e.target.value })}
          />
        )}
      </Field>

      <fieldset className="min-w-0">
        <legend className="mb-1 font-semibold text-ink">Contacto público (opcional)</legend>
        <p className="mb-3 text-sm text-ink-2">
          Para coordinar donaciones. Solo con permiso de esa persona: se publica en la ficha.
        </p>
        <Stack gap="md">
          <Field
            data-field="contactName"
            label="Nombre"
            hint="Ej.: Sra. Marta (coordinadora)"
            error={errors.contactName}
          >
            {(c) => (
              <Input
                {...c}
                value={value.contactName}
                maxLength={80}
                autoComplete="off"
                onChange={(e) => onChange({ contactName: e.target.value })}
              />
            )}
          </Field>
          <Field data-field="contactPhone" label="Teléfono" error={errors.contactPhone}>
            {(c) => (
              <Input
                {...c}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={value.contactPhone}
                maxLength={30}
                onChange={(e) =>
                  onChange({ contactPhone: e.target.value, ...(sameWa ? { contactWhatsapp: e.target.value } : {}) })
                }
              />
            )}
          </Field>
          {value.contactPhone.trim() !== '' && (
            <Checkbox
              checked={sameWa}
              onCheckedChange={(v) => onChange({ contactWhatsapp: v ? value.contactPhone : '' })}
              label="El WhatsApp es el mismo número"
            />
          )}
          {!sameWa && (
            <Field data-field="contactWhatsapp" label="WhatsApp" error={errors.contactWhatsapp}>
              {(c) => (
                <Input
                  {...c}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={value.contactWhatsapp}
                  maxLength={30}
                  onChange={(e) => onChange({ contactWhatsapp: e.target.value })}
                />
              )}
            </Field>
          )}
          {hasContact(value) && (
            <div data-field="contactConsent">
              <Checkbox
                checked={value.contactConsent}
                onCheckedChange={(v) => onChange({ contactConsent: !!v })}
                aria-invalid={errors.contactConsent ? true : undefined}
                label="Esta persona acepta que su nombre y teléfono se publiquen para coordinar donaciones"
              />
              {errors.contactConsent && <p className="mt-1 text-sm text-ink-danger">{errors.contactConsent}</p>}
            </div>
          )}
        </Stack>
      </fieldset>

      <Field
        data-field="notes"
        label="Notas (opcional)"
        hint="Ej.: no reciben ropa usada; tienen estacionamiento."
        error={errors.notes}
      >
        {(c) => (
          <Textarea
            {...c}
            rows={3}
            autosize
            value={value.notes}
            maxLength={600}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        )}
      </Field>
    </Stack>
  );
}

const PHONE_RE = /^[0-9+()\-\s]*$/;
function phoneError(p: string): string | undefined {
  if (!p.trim()) return undefined;
  if (!PHONE_RE.test(p)) return 'Solo números, espacios, + y -';
  if (p.replace(/\D/g, '').length < 7) return 'Número incompleto';
  return undefined;
}

/** Validación local mínima (la API es la fuente de verdad). */
export function validateLocal(v: CenterInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.name.trim().length < 3) e.name = 'Escribe el nombre del centro';
  if (!v.centerType) e.centerType = 'Elige el tipo de centro';
  if (!v.organizerType) e.organizerType = 'Elige quién lo organiza';
  if (!v.province) e.province = 'Elige la provincia o comarca';
  if (v.address.trim().length < 3) e.address = 'Escribe la dirección o una referencia';
  if (v.lat === null || v.lng === null) e.lat = 'Marca la ubicación exacta';
  for (const [d, msg] of Object.entries(scheduleErrors(v.schedule))) e[`schedule.${d}`] = msg;
  const pe = phoneError(v.contactPhone);
  if (pe) e.contactPhone = pe;
  const we = phoneError(v.contactWhatsapp);
  if (we) e.contactWhatsapp = we;
  if (hasContact(v) && !v.contactConsent)
    e.contactConsent = 'Marca la casilla para publicar el contacto, o borra sus datos';
  return e;
}

/** Cuerpo para la API: sin espacios de más; sin consentimiento si no hay contacto. */
export function toBody(v: CenterInput) {
  const contact = hasContact(v);
  return {
    ...v,
    name: v.name.trim(),
    organizerName: v.organizerName.trim(),
    district: v.district.trim(),
    community: v.community.trim(),
    address: v.address.trim(),
    hoursNote: v.hoursNote.trim(),
    contactName: v.contactName.trim(),
    contactPhone: v.contactPhone.trim(),
    contactWhatsapp: v.contactWhatsapp.trim(),
    contactConsent: contact ? v.contactConsent : false,
    notes: v.notes.trim(),
  };
}
