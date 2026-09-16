import { ConfigService } from '@nestjs/config';
import { esEscrituraPermitida, OracleService } from './oracle.service';

const servicio = (valores: Record<string, string> = {}) =>
  new OracleService({
    get: (clave: string) => valores[clave],
  } as unknown as ConfigService);

const COMPLETO = {
  ORACLE_USER: 'u',
  ORACLE_PASSWORD: 'p',
  ORACLE_CONNECT_STRING: 'x',
};

describe('OracleService', () => {
  it('consultar rechaza cualquier sentencia que no sea SELECT, sin intentar conectarse', async () => {
    const oracle = servicio(COMPLETO);
    const sentencias = [
      'UPDATE t SET a = 1',
      'DELETE FROM t',
      'INSERT INTO t VALUES (1)',
      'BEGIN NULL; END;',
      'MERGE INTO t USING s ON (1 = 1)',
    ];
    for (const sql of sentencias) {
      await expect(oracle.consultar(sql)).rejects.toThrow(
        'solo acepta consultas SELECT',
      );
    }
  });

  it('solo se considera configurado con usuario, clave y cadena de conexión', () => {
    expect(
      servicio({ ORACLE_USER: 'u', ORACLE_PASSWORD: 'p' }).configurado(),
    ).toBe(false);
    expect(servicio(COMPLETO).configurado()).toBe(true);
  });

  it('sin configuración, verificar informa en vez de lanzar', async () => {
    await expect(servicio().verificar()).resolves.toEqual({
      configurado: false,
      conectado: false,
    });
  });
});

describe('esEscrituraPermitida', () => {
  it.each([
    'INSERT INTO "OPS$ANDES"."ERP_TRACTA" (A) VALUES (1)',
    'insert into "ops$andes"."erp_tracta"(a) select 1 from dual',
    '  UPDATE   "OPS$ANDES"."ERP_TRACTA"   SET A = 1 WHERE B = 2',
  ])('permite INSERT o UPDATE sobre ERP_TRACTA: %s', (sql) => {
    expect(esEscrituraPermitida(sql)).toBe(true);
  });

  it.each([
    'DELETE FROM "OPS$ANDES"."ERP_TRACTA" WHERE TCT_SECUENCIA = 1',
    'UPDATE "OPS$ANDES"."ERP_CONTAB" SET A = 1',
    'INSERT INTO "OPS$ANDES"."RP_CONTA" (A) VALUES (1)',
    'MERGE INTO "OPS$ANDES"."ERP_TRACTA" t USING dual ON (1 = 1)',
    'BEGIN PKG_ERP_CONTAB_ACTUALIZA.PRD_INSERT_ERP_CONTAB; END;',
    'UPDATE "OPS$ANDES"."ERP_TRACTA_HIST" SET A = 1',
    'TRUNCATE TABLE "OPS$ANDES"."ERP_TRACTA"',
  ])('rechaza cualquier otra escritura: %s', (sql) => {
    expect(esEscrituraPermitida(sql)).toBe(false);
  });
});
