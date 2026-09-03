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
