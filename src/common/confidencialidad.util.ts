/**
 * TODO: hoy replica el hardcode del prototipo (server_mock.py línea ~310:
 * `ruta_id in ["R15", "R19"]`). Debería migrarse a una columna
 * `confidencial boolean` en rutas_pago para no volver a tocar código cada
 * vez que cambie el catálogo. Se deja centralizado acá para que ese cambio
 * futuro sea de un solo lugar.
 */
const RUTAS_CONFIDENCIALES = new Set(['R15', 'R19']);

export function esRutaConfidencial(rutaId: string): boolean {
  return RUTAS_CONFIDENCIALES.has(rutaId);
}

/**
 * Aplica el enmascaramiento RLS del lado del servidor. El campo `puedeVer`
 * viene de la sesión del usuario (rol / permiso); mientras no exista Keycloak
 * integrado, se pasa `false` por defecto (postura restrictiva).
 */
export function enmascararSiConfidencial<T extends {
  solicitante: string;
  monto: number;
}>(dato: T, confidencial: boolean, puedeVer: boolean): T & { confidencial: boolean } {
  if (!confidencial || puedeVer) {
    return { ...dato, confidencial };
  }
  return {
    ...dato,
    solicitante: '[REGISTRO CONFIDENCIAL]',
    monto: null as unknown as number,
    confidencial: true,
  };
}
