/**
 * Tests de src/lib/spreadsheet.js, el envoltorio sobre hucre.
 *
 * Se escriben con la migración de xlsx -> hucre porque el camino de escritura no
 * tenía NI UN test: ReporteVencimientos.test.js solo cubría calcDias, así que
 * `exportXLSX` se podía romper sin que nada avisara.
 *
 * Los casos de lectura hacen ida y vuelta (escribir con hucre y volver a leer),
 * que es la forma de comprobar de verdad la paridad con lo que hacía
 * `sheet_to_json(sheet, { defval: '', cellDates: true })`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildXlsx,
  downloadXlsx,
  objectsToAoa,
  readSheetNames,
  readSheetObjects,
} from '@/lib/spreadsheet';

/** hucre devuelve Uint8Array; readObjects espera un ArrayBuffer. */
const toArrayBuffer = (bytes) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const escribir = async (sheets) => toArrayBuffer(await buildXlsx(sheets));

describe('objectsToAoa', () => {
  it('pone las claves como fila de cabeceras, igual que json_to_sheet', () => {
    expect(objectsToAoa([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]))
      .toEqual([['a', 'b'], [1, 'x'], [2, 'y']]);
  });

  it('devuelve matriz vacía sin filas', () => {
    expect(objectsToAoa([])).toEqual([]);
    expect(objectsToAoa(null)).toEqual([]);
    expect(objectsToAoa(undefined)).toEqual([]);
  });

  it('no pierde columnas que solo aparecen en filas posteriores', () => {
    // El riesgo real: deducir las cabeceras solo del primer objeto.
    expect(objectsToAoa([{ a: 1 }, { a: 2, extra: 9 }]))
      .toEqual([['a', 'extra'], [1, ''], [2, 9]]);
  });

  it('respeta el orden de primera aparición de cada clave', () => {
    const [headers] = objectsToAoa([{ z: 1, a: 2 }, { m: 3 }]);
    expect(headers).toEqual(['z', 'a', 'm']);
  });

  it('rellena los huecos con cadena vacía, no con null', () => {
    expect(objectsToAoa([{ a: null, b: undefined, c: 0 }]))
      .toEqual([['a', 'b', 'c'], ['', '', 0]]);
  });
});

describe('readSheetNames', () => {
  it('devuelve los nombres en el orden del fichero', async () => {
    const buf = await escribir([
      { name: 'Resumen', rows: [['a']] },
      { name: 'Detalle', rows: [['b']] },
    ]);
    expect(await readSheetNames(buf)).toEqual(['Resumen', 'Detalle']);
  });
});

describe('readSheetObjects', () => {
  it('proyecta la hoja a objetos con la primera fila como cabecera', async () => {
    const buf = await escribir([
      { name: 'H', rows: [['codigo', 'cant'], ['A1', 5], ['B2', 7]] },
    ]);
    const { rows, headers } = await readSheetObjects(buf, 'H');
    expect(headers).toEqual(['codigo', 'cant']);
    expect(rows).toEqual([{ codigo: 'A1', cant: 5 }, { codigo: 'B2', cant: 7 }]);
  });

  it('da cadena vacía en las celdas vacías, como defval:"" de xlsx', async () => {
    // hucre las daría como null; spreadsheet.js lo normaliza para no cambiar el
    // comportamiento del que dependen los mapeos de TabImportar.
    const buf = await escribir([
      { name: 'H', rows: [['a', 'b', 'c'], [1, null, 3]] },
    ]);
    const { rows } = await readSheetObjects(buf, 'H');
    expect(rows).toEqual([{ a: 1, b: '', c: 3 }]);
  });

  it('lee una hoja por nombre, no solo la primera', async () => {
    const buf = await escribir([
      { name: 'Primera', rows: [['x'], [1]] },
      { name: 'Segunda', rows: [['y'], [2]] },
    ]);
    expect((await readSheetObjects(buf, 'Segunda')).rows).toEqual([{ y: 2 }]);
  });

  it('deja el buffer reutilizable, que es lo que permite cambiar de hoja', async () => {
    const buf = await escribir([
      { name: 'A', rows: [['x'], [1]] },
      { name: 'B', rows: [['y'], [2]] },
    ]);
    await readSheetNames(buf);
    expect((await readSheetObjects(buf, 'A')).rows).toEqual([{ x: 1 }]);
    expect((await readSheetObjects(buf, 'B')).rows).toEqual([{ y: 2 }]);
  });

  it('devuelve las fechas como Date, para que parseDate las reconozca', async () => {
    const buf = await escribir([
      { name: 'F', rows: [['fecha'], [new Date('2026-03-15T00:00:00Z')]] },
    ]);
    const { rows } = await readSheetObjects(buf, 'F');
    expect(rows[0].fecha).toBeInstanceOf(Date);
    // parseDate hace .toISOString().slice(0,10): el día debe salir intacto.
    expect(rows[0].fecha.toISOString().slice(0, 10)).toBe('2026-03-15');
  });
});

describe('buildXlsx', () => {
  it('produce un zip xlsx (empieza por PK)', async () => {
    const bytes = await buildXlsx([{ name: 'H', rows: [['a'], [1]] }]);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it('sobrevive el ida y vuelta de las dos hojas que exporta el reporte', async () => {
    const detalle = [
      { categoria: '0-7 días', producto: 'Arroz', valor: 100.25 },
      { categoria: '8-30 días', producto: 'Aceite', valor: 250 },
    ];
    const buf = await escribir([
      { name: 'Resumen', rows: [['Categoría', 'Lotes'], ['0-7 días', 3], ['TOTAL', 3]] },
      { name: 'Detalle', rows: objectsToAoa(detalle) },
    ]);
    expect(await readSheetNames(buf)).toEqual(['Resumen', 'Detalle']);
    expect((await readSheetObjects(buf, 'Detalle')).rows).toEqual(detalle);
    expect((await readSheetObjects(buf, 'Resumen')).rows).toEqual([
      { 'Categoría': '0-7 días', Lotes: 3 },
      { 'Categoría': 'TOTAL', Lotes: 3 },
    ]);
  });
});

describe('downloadXlsx', () => {
  afterEach(() => vi.restoreAllMocks());

  it('dispara la descarga con el nombre pedido y suelta el object URL', async () => {
    // Sustituye a XLSX.writeFile, que descargaba por su cuenta; aquí el <a> y el
    // Blob los monta spreadsheet.js, así que conviene fijarlo con un test.
    const createURL = vi.fn(() => 'blob:fake');
    const revokeURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: createURL, revokeObjectURL: revokeURL });
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === 'a') el.click = click;
      return el;
    });

    await downloadXlsx('reporte.xlsx', [{ name: 'H', rows: [['a'], [1]] }]);

    expect(createURL).toHaveBeenCalledOnce();
    expect(createURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeURL).toHaveBeenCalledWith('blob:fake');
    // El <a> no debe quedarse colgando en el DOM.
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
