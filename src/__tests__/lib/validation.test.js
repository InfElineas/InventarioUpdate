/**
 * Fija los mensajes de error de los schemas Zod.
 *
 * Existe por una regresión silenciosa de la migración a Zod 4: los params
 * `invalid_type_error` / `required_error` se eliminaron y Zod los IGNORA sin
 * avisar, así que los mensajes pasaban a salir en inglés ("Invalid input:
 * expected number, received undefined") con la suite entera en verde. Ninguno
 * de los tests existentes lo detectó porque `validateMerma` valida a mano y el
 * único consumidor vivo de estos schemas (ImportarProductos) descarta el
 * mensaje y solo cuenta filas saltadas.
 *
 * Estos tests cubren `formatZodError`, que hoy no tiene consumidores: son la
 * red que hace falta el día que un formulario empiece a mostrar estos textos.
 */
import { describe, it, expect } from 'vitest';
import {
  importRowSchema,
  mermaSchema,
  loteIcSchema,
  formatZodError,
  validate,
} from '@/lib/validation';

const msg = (schema, data) => formatZodError(schema.safeParse(data));

describe('mensajes de tipo/obligatoriedad (los que rompió Zod 4)', () => {
  it('distingue campo ausente de campo con tipo equivocado', () => {
    expect(msg(mermaSchema, { clasif_merma: 'Mal estado' })).toBe('Cantidad requerida');
    expect(msg(mermaSchema, { cantidad: 'abc', clasif_merma: 'Mal estado' }))
      .toBe('Cantidad debe ser numérica');
  });

  it('usa la etiqueta recibida en lugar de un texto genérico', () => {
    expect(msg(loteIcSchema, {})).toBe('Cantidad por vencer requerida');
    expect(msg(loteIcSchema, { cant_x_vencer: 'x' })).toBe('Cantidad por vencer debe ser numérica');
  });

  it('no deja escapar los mensajes por defecto en inglés', () => {
    for (const data of [{}, { cantidad: 'abc' }, { cantidad: null }]) {
      expect(msg(mermaSchema, data)).not.toMatch(/invalid input|expected|received/i);
    }
  });
});

describe('reglas numéricas', () => {
  it('mantiene los mensajes de int/positive/max', () => {
    const base = { clasif_merma: 'Mal estado' };
    expect(msg(mermaSchema, { ...base, cantidad: 3.5 })).toBe('Cantidad debe ser un número entero');
    expect(msg(mermaSchema, { ...base, cantidad: 0 })).toBe('Cantidad debe ser mayor a 0');
    expect(msg(mermaSchema, { ...base, cantidad: 100_001 }))
      .toBe('Cantidad no puede superar 100.000');
  });

  it('rechaza negativos con el mensaje de nonNegativeNum', () => {
    expect(msg(importRowSchema, { codigo: 'A1', cantidad: -1 }))
      .toBe('Valor no puede ser negativo');
  });

  it('rechaza Infinity (Zod 4 lo corta ya en la comprobación de tipo)', () => {
    expect(msg(importRowSchema, { codigo: 'A1', cantidad: Infinity }))
      .toBe('Valor debe ser numérico');
  });
});

describe('importRowSchema — el único schema con consumidor vivo', () => {
  it('acepta una fila válida y normaliza vía data', () => {
    const r = importRowSchema.safeParse({ codigo: 'A1', cantidad: 5 });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ codigo: 'A1', cantidad: 5 });
  });

  it('exige código no vacío', () => {
    expect(msg(importRowSchema, { codigo: '', cantidad: 5 })).toBe('Código vacío');
  });

  it('rechaza cantidad no numérica, que es como llega un parseFloat fallido', () => {
    expect(msg(importRowSchema, { codigo: 'A1', cantidad: NaN }))
      .toBe('Valor debe ser numérico');
  });
});

describe('validate()', () => {
  it('devuelve ok con los datos parseados', () => {
    expect(validate(importRowSchema, { codigo: 'A1', cantidad: 2 }))
      .toEqual({ ok: true, data: { codigo: 'A1', cantidad: 2 }, error: null });
  });

  it('devuelve el primer mensaje en caso de fallo', () => {
    const r = validate(importRowSchema, { codigo: '', cantidad: 'x' });
    expect(r.ok).toBe(false);
    expect(r.data).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
