/**
 * Lectura y escritura de hojas de cálculo, sobre `hucre`.
 *
 * Existe para aislar el motor en un solo sitio (antes era `xlsx` importado
 * directamente en los componentes) y, sobre todo, para que la exportación sea
 * testeable: el camino de escritura no tenía ni un test.
 *
 * Dos diferencias de `hucre` frente a `xlsx` que se normalizan aquí, para que
 * los componentes no tengan que saberlo:
 *
 *  - Celdas vacías: `hucre` las da como `null`; `xlsx` con `defval: ''` las
 *    daba como cadena vacía. Se mantiene la cadena vacía (ver EMPTY_CELL).
 *  - `json_to_sheet` de `xlsx` deducía la fila de cabeceras de las claves de
 *    los objetos; `hucre` escribe matrices, así que esa proyección se hace en
 *    `objectsToAoa`.
 */
import { read, readObjects, write } from 'hucre'

/** Con qué se rellenan las celdas vacías, para igualar `defval: ''` de xlsx. */
const EMPTY_CELL = ''

const fillEmpty = (value) => (value === null || value === undefined ? EMPTY_CELL : value)

/** Nombres de las hojas de un fichero, en su orden original. */
export async function readSheetNames(input) {
  const workbook = await read(input)
  return workbook.sheets.map((sheet) => sheet.name)
}

/**
 * Una hoja como array de objetos, con la primera fila de cabecera.
 * Devuelve también las cabeceras detectadas, que `hucre` da directamente en vez
 * de haber que sacarlas de `Object.keys(rows[0])`.
 */
export async function readSheetObjects(input, sheetName) {
  const { data, headers } = await readObjects(input, {
    sheet: sheetName,
    transformValue: fillEmpty,
  })
  return { rows: data, headers }
}

/**
 * Array de objetos -> matriz con fila de cabeceras, como hacía
 * `XLSX.utils.json_to_sheet`.
 *
 * Las cabeceras son la UNIÓN de las claves de todos los objetos, en orden de
 * primera aparición: si una fila trae una clave que la primera no tenía, esa
 * columna no debe perderse.
 */
export function objectsToAoa(objects) {
  if (!objects?.length) return []
  const headers = []
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      if (!headers.includes(key)) headers.push(key)
    }
  }
  return [headers, ...objects.map((obj) => headers.map((h) => fillEmpty(obj[h])))]
}

/** Los bytes de un .xlsx. `sheets`: [{ name, rows }] con `rows` como matriz. */
export async function buildXlsx(sheets) {
  return write({ format: 'xlsx', sheets })
}

/**
 * Genera el .xlsx y lo descarga. Sustituye a `XLSX.writeFile`, que disparaba la
 * descarga por su cuenta; `hucre` solo devuelve los bytes, así que el Blob y el
 * <a download> los montamos aquí.
 */
export async function downloadXlsx(filename, sheets) {
  const bytes = await buildXlsx(sheets)
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Sin esto el Blob se queda retenido hasta que se recargue la página.
    URL.revokeObjectURL(url)
  }
}
