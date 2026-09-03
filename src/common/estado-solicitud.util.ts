export interface EstadoResuelto {
  codigo: string;
  etiqueta: string;
  color: string;
}

const ESTADOS: Record<string, EstadoResuelto> = {
  PENDIENTE_APROBACION: { codigo: 'PENDIENTE_APROBACION', etiqueta: 'Pendiente VB', color: '#f59e0b' },
  APROBADO_CONTABILIZAR: { codigo: 'APROBADO_CONTABILIZAR', etiqueta: 'Aprobado Cont.', color: '#f59e0b' },
  EN_REPARO: { codigo: 'EN_REPARO', etiqueta: 'En Reparo', color: '#ef4444' },
  INTEGRADO_SAP: { codigo: 'INTEGRADO_SAP', etiqueta: 'Integrado SAP', color: '#10b981' },
  ERROR_SAP: { codigo: 'ERROR_SAP', etiqueta: 'Error SAP', color: '#dc2626' },
  RECHAZADO_CERRADO: { codigo: 'RECHAZADO_CERRADO', etiqueta: 'Rechazado', color: '#64748b' },
};

export function resolverEstado(codigo: string): EstadoResuelto {
  return ESTADOS[codigo] ?? { codigo, etiqueta: codigo, color: '#64748b' };
}

/**
 * Único lugar donde se decide qué puede hacer el usuario con un ticket.
 * El front pinta un botón por cada acción que llegue en el arreglo — nunca
 * decide según el estado por su cuenta. Hoy no distingue por rol; cuando
 * exista sesión real (Keycloak), este es el punto donde se cruza con permisos.
 */
export function resolverAcciones(codigo: string): string[] {
  switch (codigo) {
    case 'PENDIENTE_APROBACION':
      return ['ver_detalle', 'ver_bitacora', 'aprobar', 'rechazar'];
    case 'APROBADO_CONTABILIZAR':
      return ['ver_detalle', 'ver_bitacora', 'contabilizar'];
    case 'EN_REPARO':
      return ['ver_detalle', 'ver_bitacora', 'reenviar_aprobacion'];
    case 'INTEGRADO_SAP':
      return ['ver_detalle', 'ver_bitacora', 'reversar'];
    default:
      return ['ver_detalle', 'ver_bitacora'];
  }
}
