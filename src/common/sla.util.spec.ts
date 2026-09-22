import { resolverSla } from './sla.util';

describe('resolverSla', () => {
  const enHoras = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);

  it('marca como cumplido lo que ya está integrado en SAP', () => {
    const sla = resolverSla('INTEGRADO_SAP', enHoras(-100));

    expect(sla.estado).toBe('CUMPLIDO');
    expect(sla.etiqueta).toBe('Cumplido');
  });

  it('informa la fecha límite aunque el ticket ya esté integrado', () => {
    const limite = enHoras(-100);

    expect(resolverSla('INTEGRADO_SAP', limite).venceEn).toBe(limite.toISOString());
  });

  it('informa la fecha límite en los tickets vencidos y por vencer', () => {
    const vencido = enHoras(-30);
    const porVencer = enHoras(3);

    expect(resolverSla('PENDIENTE_APROBACION', vencido).venceEn).toBe(vencido.toISOString());
    expect(resolverSla('PENDIENTE_APROBACION', vencido).estado).toBe('VENCIDO');
    expect(resolverSla('PENDIENTE_APROBACION', porVencer).venceEn).toBe(porVencer.toISOString());
    expect(resolverSla('PENDIENTE_APROBACION', porVencer).estado).toBe('POR_VENCER');
  });

  it('deja la fecha en null sólo cuando el ticket no tiene plazo calculado', () => {
    const sla = resolverSla('PENDIENTE_APROBACION', null);

    expect(sla.venceEn).toBeNull();
    expect(sla.estado).toBe('EN_TIEMPO');
  });

  it('describe cuánto falta cuando el plazo sigue vigente', () => {
    const sla = resolverSla('PENDIENTE_APROBACION', enHoras(30));

    expect(sla.estado).toBe('EN_TIEMPO');
    expect(sla.etiqueta).toMatch(/^Faltan 1d/);
  });
});
