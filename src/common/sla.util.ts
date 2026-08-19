export type EstadoSla = 'CUMPLIDO' | 'VENCIDO' | 'POR_VENCER' | 'EN_TIEMPO';

export interface SlaResuelto {
  estado: EstadoSla;
  etiqueta: string;
  color: string;
  venceEn: string | null;
}

/**
 * Traduce fecha_limite_sla + estado_solicitud a la forma que consume la UI.
 * El plazo (2 días hábiles) ya lo calculó el trigger fn_calcular_fecha_limite_sla
 * en Postgres al crear el ticket; acá sólo se compara contra "ahora".
 */
export function resolverSla(estadoSolicitud: string, fechaLimiteSla: Date | null): SlaResuelto {
  if (estadoSolicitud === 'INTEGRADO_SAP') {
    return { estado: 'CUMPLIDO', etiqueta: 'Cumplido', color: '#3b82f6', venceEn: null };
  }

  if (!fechaLimiteSla) {
    return { estado: 'EN_TIEMPO', etiqueta: 'En tiempo', color: '#10b981', venceEn: null };
  }

  const ahora = new Date();
  const diffMs = fechaLimiteSla.getTime() - ahora.getTime();
  const diffHoras = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    const horas = Math.abs(diffHoras);
    const etiqueta =
      horas >= 24
        ? `Vencido hace ${Math.floor(horas / 24)}d ${Math.floor(horas % 24)}h`
        : `Vencido hace ${Math.floor(horas)}h ${Math.floor((Math.abs(diffMs) / (1000 * 60)) % 60)}m`;
    return { estado: 'VENCIDO', etiqueta, color: '#ef4444', venceEn: fechaLimiteSla.toISOString() };
  }

  if (diffHoras <= 12) {
    const etiqueta = `Faltan ${Math.floor(diffHoras)}h ${Math.floor((diffMs / (1000 * 60)) % 60)}m`;
    return { estado: 'POR_VENCER', etiqueta, color: '#f59e0b', venceEn: fechaLimiteSla.toISOString() };
  }

  const etiqueta =
    diffHoras >= 24
      ? `Faltan ${Math.floor(diffHoras / 24)}d ${Math.floor(diffHoras % 24)}h`
      : `Faltan ${Math.floor(diffHoras)}h ${Math.floor((diffMs / (1000 * 60)) % 60)}m`;
  return { estado: 'EN_TIEMPO', etiqueta, color: '#10b981', venceEn: fechaLimiteSla.toISOString() };
}
