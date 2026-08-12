/**
 * Tests de `count()` de base44Client.
 *
 * Se añade con el cambio de los contadores del menú: antes se descargaban
 * cientos de registros para hacerles un `.filter().length`, y ahora se cuenta en
 * Postgres. Lo que hay que fijar es que la consulta se ARME bien —
 * `count: 'exact'` con `head: true` (sin filas en la respuesta) y el filtro
 * correcto—, porque un fallo ahí no rompe nada: devuelve un número equivocado o
 * un badge vacío, en silencio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const espia = { select: null, eq: null, in: null, from: null };
let respuesta;

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: (...args) => {
      espia.from(...args);
      const q = {
        select: (...a) => { espia.select(...a); return q; },
        eq: (...a) => { espia.eq(...a); return q; },
        in: (...a) => { espia.in(...a); return q; },
        then: (resolve) => resolve(respuesta),
      };
      return q;
    },
  },
}));

vi.mock('@/lib/security', () => ({ sanitizeError: (e) => e.message }));

const { base44 } = await import('@/api/base44Client');

beforeEach(() => {
  espia.from = vi.fn(); espia.select = vi.fn(); espia.eq = vi.fn(); espia.in = vi.fn();
  respuesta = { count: 0, error: null };
});

describe('count()', () => {
  it('pide el total sin traer filas', async () => {
    respuesta = { count: 7, error: null };
    expect(await base44.entities.Merma.count()).toBe(7);
    expect(espia.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
  });

  it('apunta a la tabla mapeada de la entidad', async () => {
    await base44.entities.Merma.count();
    expect(espia.from).toHaveBeenCalledWith('mermas');
    await base44.entities.AnuncioDesact.count();
    expect(espia.from).toHaveBeenCalledWith('anuncios_desact');
  });

  it('traduce un valor escalar a eq', async () => {
    await base44.entities.Inventario.count({ estado_tarea: 'pend_fact' });
    expect(espia.eq).toHaveBeenCalledWith('estado_tarea', 'pend_fact');
    expect(espia.in).not.toHaveBeenCalled();
  });

  it('traduce un array a in, que es lo que necesitan los lotes críticos', async () => {
    await base44.entities.Lote.count({ estado_fv: ['critico', 'vencido'] });
    expect(espia.in).toHaveBeenCalledWith('estado_fv', ['critico', 'vencido']);
    expect(espia.eq).not.toHaveBeenCalled();
  });

  it('combina varias condiciones', async () => {
    await base44.entities.Merma.count({ estado_tarea: 'pendiente', almacen_num: '001' });
    expect(espia.eq).toHaveBeenCalledWith('estado_tarea', 'pendiente');
    expect(espia.eq).toHaveBeenCalledWith('almacen_num', '001');
  });

  it('devuelve 0 si Postgres no manda count, en vez de null', async () => {
    respuesta = { count: null, error: null };
    expect(await base44.entities.Merma.count()).toBe(0);
  });

  it('propaga el error saneado', async () => {
    respuesta = { count: null, error: new Error('boom') };
    await expect(base44.entities.Merma.count()).rejects.toThrow('boom');
  });

  it('Lote cuenta sobre la vista lotes_vigencia, no sobre una tabla', async () => {
    await base44.entities.Lote.count({ estado_fv: ['critico'] });
    expect(espia.from).toHaveBeenCalledWith('lotes_vigencia');
  });
});
