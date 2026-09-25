/**
 * Retool no puede mandar listas ni objetos anidados en el cuerpo de una
 * petición: sus cuerpos son pares clave/valor de texto plano. El acuerdo del
 * proyecto es que el front manda un JSON.stringify y el DTO lo deshace aquí.
 *
 * Si el texto no es un JSON válido se devuelve tal cual: así el error que ve
 * el usuario lo produce la validación del campo ("debe ser una lista"), que
 * dice algo útil, y no una excepción de parseo en medio del pipe.
 */
export const textoComoLista = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim();
  if (limpio === '') return [];
  try {
    const datos: unknown = JSON.parse(limpio);
    return Array.isArray(datos) ? datos : value;
  } catch {
    return value;
  }
};

/** Un 'true' de un formulario multipart llega como texto, no como booleano. */
export const textoComoBooleano = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const limpio = value.trim().toLowerCase();
  if (limpio === 'true') return true;
  if (limpio === 'false' || limpio === '') return false;
  return value;
};
