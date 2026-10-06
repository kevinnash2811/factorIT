import { paginaSelector, paginaSinConfigurar } from './selector.pagina';

const CONFIG = {
  clientId: '1234.apps.googleusercontent.com',
  apiKey: 'AIzaSyEJEMPLO',
  origenPermitido: 'https://cajalosandes.retool.com',
};

describe('página del selector de Drive', () => {
  it('explica qué falta cuando no hay credenciales', () => {
    const html = paginaSinConfigurar();

    expect(html).toContain('Falta configurar');
    expect(html).toContain('GOOGLE_CLIENT_ID');
    expect(html).toContain('GOOGLE_API_KEY');
  });

  it('carga las dos librerías oficiales de Google', () => {
    const html = paginaSelector(CONFIG);

    expect(html).toContain('accounts.google.com/gsi/client');
    expect(html).toContain('apis.google.com/js/api.js');
  });

  it('pide el permiso más acotado y nada más', () => {
    const html = paginaSelector(CONFIG);

    expect(html).toContain('https://www.googleapis.com/auth/drive.file');
    // Los permisos amplios dejarían ver todo el Drive de la persona.
    expect(html).not.toContain('auth/drive.readonly');
    expect(html).not.toContain("'https://www.googleapis.com/auth/drive'");
  });

  it('devuelve el resultado solo al portal, no a cualquier sitio', () => {
    const html = paginaSelector(CONFIG);

    expect(html).toContain(CONFIG.origenPermitido);
    expect(html).toContain('CONFIG.origen');
  });

  it('no le manda el token de Google a la aplicación', () => {
    const html = paginaSelector(CONFIG);
    const envio = html.slice(html.indexOf('postMessage'));

    // Lo que viaja de vuelta es el resultado ya copiado, nunca la credencial.
    expect(envio).toContain('resultado');
    expect(/postMessage\([^)]*token/.test(envio)).toBe(false);
  });

  it('deja elegir varios archivos y habla en español', () => {
    const html = paginaSelector(CONFIG);

    expect(html).toContain('MULTISELECT_ENABLED');
    expect(html).toContain("setLocale('es')");
  });

  it('avisa si el usuario no autoriza', () => {
    expect(paginaSelector(CONFIG)).toContain('No se otorgó la autorización');
  });
});
