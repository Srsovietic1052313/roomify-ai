# Roomify

Aplicación web que convierte el plano 2D de una vivienda en un render 3D con IA. Guarda tus proyectos en tu computadora y compara el antes y el después con un deslizador.

Inspirada en el video [Build and Deploy a Full-Stack AI App (Completely Free)](https://www.youtube.com/watch?v=JiwTGGGIhDs) de JavaScript Mastery. Es una implementación propia a partir de la descripción del video: no incluye el código ni los recursos de su kit.

**Tecnologías:** React, TypeScript, Vite, Express, SQLite (`node:sqlite`), sharp y [Workers AI de Cloudflare](https://developers.cloudflare.com/workers-ai/) con FLUX.2.

## Descargar la app de escritorio

No necesitas instalar Python ni Node:

1. Descarga [**Roomify.exe**](https://github.com/Srsovietic1052313/roomify-ai/releases/latest/download/Roomify.exe) (unos 110 MB).
2. Haz doble clic.

Windows puede mostrar una advertencia de SmartScreen porque el ejecutable no tiene firma digital. Pulsa **Más información** y luego **Ejecutar de todas formas** solo si lo descargaste de este repositorio.

Abre **Ajustes** y elige una opción:

- **Modo demo:** márcalo para ver la app sin cuenta. No usa IA.
- **IA real:** escribe tu Account ID y tu API token de Cloudflare. El token se guarda cifrado por Windows para tu usuario.

La app tarda unos 15 segundos en abrir.

**Tus datos:** los proyectos, imágenes y ajustes se guardan en `%APPDATA%\Roomify`.

**Crear el ejecutable tú mismo:**

```bash
npm install
npm run empaquetar
```

**Qué se comprobó en el ejecutable:** ajustes, subida, render en modo demo, comparador y eliminación. **Sigue sin probarse una llamada real a Cloudflare.**

## Ejecutarlo desde el código

Requiere Node 22.18 o superior.

```bash
npm install
```

### Ver la app sin cuenta

```bash
npm run demo
```

Abre http://localhost:5173. El modo demo **no usa IA**: el "render" es el mismo plano con otro color.

### Usar la IA real

1. Crea una cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. Copia tu **Account ID** desde el panel de Cloudflare.
3. Crea un **API token** con el permiso **Workers AI** y cópialo.
4. Copia `.env.example` como `.env` y rellena esos dos datos. Nunca compartas ni subas `.env`.
5. Ejecuta:

   ```bash
   npm run dev
   ```

### Producción local y pruebas

```bash
npm run build
npm start
npm test
```

Con `npm start`, la app queda en http://localhost:3001. Puedes cambiar el puerto con la variable `API_PORT`.

## Costo

Según la [página de precios](https://developers.cloudflare.com/workers-ai/platform/pricing/) consultada en noviembre de 2026, Workers AI incluye 10 000 Neurons gratis al día y cobra $0.011 por cada 1000 adicionales.

Con 20 pasos y una salida de 1024 × 1024, cada render de FLUX.2 [dev] usaría unos 3400 Neurons, unos $0.04 si se paga. Eso son 2 o 3 renders gratis al día. Es una estimación propia; revisa tu consumo en el panel de Cloudflare.

## Qué se comprobó

- 23 pruebas automáticas de la API, los ajustes, las validaciones, los errores y el adaptador de Cloudflare, este último con respuestas falsas.
- Compilación de producción y comprobación de tipos.
- En el navegador, en modo demo: generación, comparador, lista de proyectos y aviso de modo demo. Esta prueba encontró y corrigió un error que bloqueaba las peticiones.
- Con peticiones HTTP directas: subida, rechazo de archivos no válidos, eliminación y bloqueo de otros orígenes.
- `npm start` sin credenciales: sirve la app y avisa de que falta configurarla.

**No se comprobó:**

- **Una llamada real a Cloudflare.** Hace falta tu token. La [documentación](https://developers.cloudflare.com/changelog/2025-11-25-flux-2-dev-workers-ai/) confirma el formato de envío, pero no muestra la respuesta completa, así que el código acepta la imagen en `result.image` o en `image`.
- **La calidad del render.** FLUX.2 podría no respetar con exactitud la distribución del plano.

## Cómo funciona el código

### Al subir un plano

1. [`Subida.tsx`](src/components/Subida.tsx) recibe el archivo arrastrado o elegido.
2. [`api.ts`](src/lib/api.ts) lo envía con `POST /api/proyectos`. En desarrollo, Vite reenvía esa ruta a Express.
3. [`app.ts`](server/app.ts) recibe la petición. Primero, `soloLocal` rechaza las que llegan desde otros sitios web, y `multer` limita el archivo a 10 MB.
4. `normalizarPlano` en [`imagenes.ts`](server/imagenes.ts) comprueba que el contenido sea una imagen, sin fiarse de la extensión. Lo convierte a PNG y elimina metadatos como el GPS.
5. La imagen se guarda en `data/imagenes/` y [`db.ts`](server/db.ts) guarda los datos del proyecto en SQLite.
6. La página navega a `/proyecto/:id`.

### Al generar el render

1. [`PaginaProyecto.tsx`](src/pages/PaginaProyecto.tsx) llama a `POST /api/proyectos/:id/render`.
2. `crearReferencia` reduce el plano a menos de 512 píxeles, el límite documentado para FLUX.2, y `tamanoRender` calcula la salida con la misma forma.
3. `crearCloudflare` en [`ia.ts`](server/ia.ts) envía el prompt, la imagen y el tamaño. El token solo existe en el servidor: nunca llega al navegador.
4. La respuesta en base64 se convierte en bytes, y `normalizarRender` verifica que sea una imagen.
5. El servidor guarda el render con un nombre nuevo, actualiza SQLite y borra el anterior.
6. [`Comparador.tsx`](src/components/Comparador.tsx) superpone ambas imágenes y recorta la de arriba con `clip-path`, según el deslizador.

### La app de escritorio

[`desktop/main.ts`](desktop/main.ts) arranca el mismo servidor Express dentro de Electron, en un puerto libre de `127.0.0.1`, y lo muestra en una ventana. [`desktop/ajustes.ts`](desktop/ajustes.ts) guarda el token cifrado con `safeStorage`.

### Cambiar de proveedor de IA

`ia.ts` define la interfaz `ProveedorIa`, con la función `generar`. `crearSimulado` (el modo demo) y `crearCloudflare` la cumplen. Para usar otro servicio, añade una función con la misma forma y elígela en [`index.ts`](server/index.ts).

## Diferencias con el video

El video usa Puter.js para todo el backend. Esta versión lo sustituyó porque Puter bloqueó la creación de la cuenta (`signup_blocked`) y no se pudo probar. Consecuencias:

- **No tiene cuentas ni feed comunitario.** Es una app personal, y el servidor solo acepta conexiones de tu computadora.
- **Requiere tu propia cuenta de Cloudflare.** Cada usuario ya no paga su propio consumo: todo se carga a tu cuenta.
- **La app de escritorio no necesita `.env`.** Las credenciales se escriben en **Ajustes**.
- **No se puede desplegar tal cual.** Publicarla en internet requeriría añadir inicio de sesión, límites de uso y almacenamiento en la nube. Sin ellos, cualquiera podría gastar tu cuota.
