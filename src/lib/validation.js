import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────────

// Zod 4 sustituyó `invalid_type_error` / `required_error` por un único `error`,
// e IGNORA EN SILENCIO los dos antiguos: con ellos los mensajes salían en inglés
// ("Invalid input: expected number, received undefined") sin que nada fallara.
// La forma de función distingue el caso "falta el campo" (`input === undefined`)
// del caso "vino con el tipo equivocado".
const positiveInt = (max = 100_000, label = 'Cantidad') =>
  z
    .number({
      error: (issue) =>
        issue.input === undefined ? `${label} requerida` : `${label} debe ser numérica`,
    })
    .int(`${label} debe ser un número entero`)
    .positive(`${label} debe ser mayor a 0`)
    .max(max, `${label} no puede superar ${max.toLocaleString('es')}`);

// `.finite()` quedó redundante: en Zod 4 `z.number()` ya rechaza Infinity/NaN en
// la comprobación de tipo, así que un Infinity ahora responde "debe ser numérico"
// en lugar de "inválido". Se conserva por si la garantía del tipo cambia.
const nonNegativeNum = (max = 9_999_999, label = 'Valor') =>
  z
    .number({ error: `${label} debe ser numérico` })
    .min(0, `${label} no puede ser negativo`)
    .max(max, `${label} no puede superar ${max.toLocaleString('es')}`)
    .finite(`${label} inválido`);

const shortText  = z.string().max(200, 'Máximo 200 caracteres');
const notes      = z.string().max(500, 'Máximo 500 caracteres').optional().default('');

// ── Merma ────────────────────────────────────────────────
export const mermaSchema = z.object({
  cantidad:              positiveInt(100_000),
  clasif_merma:          z.string().min(1, 'Clasificación requerida').max(200),
  notas:                 notes,
  destino_final:         shortText.optional().default(''),
  rebaja_confirmada:     z.boolean().optional().default(false),
  fecha_rebaja_tienda:   z.string().optional().default(''),
  fecha_vencimiento_lote:z.string().optional().default(''),
});

// ── Importación CSV ──────────────────────────────────────
export const importRowSchema = z.object({
  codigo:   z.string().min(1, 'Código vacío').max(200),
  cantidad: nonNegativeNum(9_999_999),
});

// ── Lote IC ──────────────────────────────────────────────
export const loteIcSchema = z.object({
  cant_x_vencer:      positiveInt(999_999, 'Cantidad por vencer'),
  propuesta_precio_ic:nonNegativeNum(9_999_999, 'Precio IC').optional(),
  precio_restaurar:   nonNegativeNum(9_999_999, 'Precio a restaurar').optional(),
  clasif_inv:         shortText.optional().default(''),
  nota_inv:           notes,
  notas_ic:           notes,
});

// ── Helper: formatear errores Zod para mostrar al usuario ─
export function formatZodError(result) {
  if (result.success) return null;
  const first = result.error.issues[0];
  return first ? first.message : 'Datos inválidos';
}

/** Valida un objeto contra un schema Zod. Retorna { ok, error, data }. */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data, error: null };
  return { ok: false, data: null, error: formatZodError(result) };
}
