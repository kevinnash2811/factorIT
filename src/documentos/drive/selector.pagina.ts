/**
 * Página que se abre en una ventana aparte para elegir archivos de Drive.
 *
 * Vive en el servidor y no en Retool por una razón concreta: así el token de
 * Google nunca entra a la aplicación. La ventana pide la autorización, deja que
 * el usuario elija, le manda al servidor los identificadores junto con el
 * token, y a Retool solo le devuelve los archivos ya copiados. Si alguien
 * inspecciona la aplicación, no hay credencial de Google que encontrar.
 *
 * Usa las dos piezas oficiales de Google: Identity Services para la
 * autorización y Google Picker para el explorador de archivos.
 */

export interface ConfiguracionDrive {
  clientId: string;
  apiKey: string;
  /** Origen de la app de Retool, al que se le devuelve el resultado. */
  origenPermitido: string;
}

const ESTILOS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: Inter, -apple-system, "Segoe UI", sans-serif;
    background: #f8fafc; color: #0f172a; display: flex; align-items: center;
    justify-content: center; min-height: 100vh; padding: 24px;
  }
  .tarjeta {
    background: #fff; border-radius: 12px; padding: 32px; max-width: 460px;
    width: 100%; text-align: center;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
  }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px; }
  button {
    background: #0284c7; color: #fff; border: 0; border-radius: 8px;
    padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  button:disabled { background: #cbd5e1; cursor: default; }
  .estado { font-size: 13px; margin-top: 18px; min-height: 20px; }
  .error {
    background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
    border-radius: 8px; padding: 12px 16px; font-size: 13px; text-align: left;
  }
  .ok { color: #047857; font-weight: 600; }
  .cargando { color: #64748b; }
`;

/** Página que se muestra si faltan las credenciales de Google. */
export function paginaSinConfigurar(): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Adjuntar desde Google Drive</title><style>${ESTILOS}</style></head>
<body><div class="tarjeta">
  <h1>Falta configurar el acceso a Google Drive</h1>
  <p>Esta función necesita las credenciales de Google de la organización. Avisa
     al equipo de desarrollo: deben cargarse las variables
     <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_API_KEY</code> en el servidor.</p>
  <button onclick="window.close()">Cerrar</button>
</div></body></html>`;
}

export function paginaSelector(config: ConfiguracionDrive): string {
  const datos = JSON.stringify({
    clientId: config.clientId,
    apiKey: config.apiKey,
    origen: config.origenPermitido,
  });

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adjuntar desde Google Drive</title>
  <style>${ESTILOS}</style>
</head>
<body>
  <div class="tarjeta">
    <h1>📎 Adjuntar desde Google Drive</h1>
    <p id="ayuda">
      Se abrirá tu Google Drive para que elijas los archivos de respaldo.
      El sistema guardará una copia, así el documento queda disponible aunque
      después lo muevas o lo borres de tu Drive.
    </p>
    <button id="elegir" disabled>Conectando con Google…</button>
    <div class="estado" id="estado"></div>
  </div>

  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <script src="https://apis.google.com/js/api.js" async defer></script>
  <script>
    (function () {
      var CONFIG = ${datos};
      var boton = document.getElementById('elegir');
      var estado = document.getElementById('estado');
      var ayuda = document.getElementById('ayuda');
      var pickerListo = false;
      var gsiListo = false;

      function aviso(texto, clase) {
        estado.className = 'estado ' + (clase || '');
        estado.textContent = texto;
      }

      function error(texto) {
        estado.className = 'estado';
        estado.innerHTML = '<div class="error">' + texto + '</div>';
        boton.disabled = false;
        boton.textContent = 'Reintentar';
      }

      function habilitarSiTodoCargo() {
        if (pickerListo && gsiListo) {
          boton.disabled = false;
          boton.textContent = 'Elegir archivos de mi Drive';
        }
      }

      // Las dos librerías de Google cargan por su cuenta: se espera a ambas.
      var espera = setInterval(function () {
        if (window.gapi && !pickerListo) {
          gapi.load('picker', function () { pickerListo = true; habilitarSiTodoCargo(); });
        }
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          gsiListo = true;
          habilitarSiTodoCargo();
        }
        if (pickerListo && gsiListo) clearInterval(espera);
      }, 200);

      setTimeout(function () {
        if (!pickerListo || !gsiListo) {
          clearInterval(espera);
          error('No se pudieron cargar las librerías de Google. Revisa tu conexión y vuelve a intentar.');
        }
      }, 15000);

      boton.addEventListener('click', function () {
        boton.disabled = true;
        aviso('Esperando la autorización de Google…', 'cargando');

        // Se pide el permiso más acotado que existe: la aplicación solo ve los
        // archivos que la persona elija, nunca el resto de su Drive.
        var cliente = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: function (respuesta) {
            if (respuesta.error || !respuesta.access_token) {
              error('No se otorgó la autorización de Google. Sin ella no se puede leer el archivo que elijas.');
              return;
            }
            abrirPicker(respuesta.access_token);
          },
        });
        cliente.requestAccessToken();
      });

      function abrirPicker(token) {
        aviso('Elige los archivos en la ventana de Drive…', 'cargando');

        var vista = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false);

        var picker = new google.picker.PickerBuilder()
          .setOAuthToken(token)
          .setDeveloperKey(CONFIG.apiKey)
          .setLocale('es')
          .addView(vista)
          .addView(new google.picker.DocsUploadView())
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
          .setCallback(function (datos) {
            if (datos.action === google.picker.Action.CANCEL) {
              aviso('No elegiste ningún archivo.');
              boton.disabled = false;
              boton.textContent = 'Elegir archivos de mi Drive';
              return;
            }
            if (datos.action !== google.picker.Action.PICKED) return;

            var archivos = (datos.docs || []).map(function (d) {
              return { id: d.id, nombre: d.name, mimeType: d.mimeType };
            });
            copiar(archivos, token);
          })
          .build();

        picker.setVisible(true);
      }

      function copiar(archivos, token) {
        ayuda.textContent = 'Trayendo ' + archivos.length + ' archivo(s) a la solicitud…';
        aviso('Copiando desde Drive…', 'cargando');

        fetch('/documentos/drive/copiar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, archivos: archivos }),
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, cuerpo: j }; }); })
          .then(function (res) {
            if (!res.ok) {
              error(res.cuerpo.detalle || res.cuerpo.mensaje || 'No se pudieron copiar los archivos.');
              return;
            }
            devolver(res.cuerpo);
          })
          .catch(function () {
            error('No se pudo contactar al servidor para copiar los archivos.');
          });
      }

      function devolver(resultado) {
        var total = (resultado.items || []).length;
        aviso('Listo: ' + total + ' archivo(s) adjuntado(s). Puedes cerrar esta ventana.', 'ok');
        ayuda.textContent = 'Los archivos ya quedaron en el formulario de la solicitud.';
        boton.textContent = window.opener ? 'Cerrar' : 'Listo';
        boton.disabled = false;
        boton.onclick = function () {
          if (window.opener) window.close();
        };

        // Puede estar embebida en el Portal (lo normal) o en una ventana
        // aparte; se responde a quien corresponda en cada caso.
        var destino = window.opener || window.parent;
        if (destino && destino !== window) {
          destino.postMessage(
            { tipo: 'adjuntos-drive', resultado: resultado },
            CONFIG.origen || '*',
          );
        }

        // Embebida no se puede cerrar sola: la cierra el Portal al recibir
        // el aviso. En ventana aparte, sí.
        if (window.opener) {
          setTimeout(function () { window.close(); }, 2500);
        }
      }
    })();
  </script>
</body>
</html>`;
}
