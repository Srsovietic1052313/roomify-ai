# Roomify

Aplicación web que convierte el plano 2D de una vivienda en un render 3D fotorrealista con IA. Guarda tus proyectos, compara el antes y el después con un deslizador y permite publicar resultados en un feed comunitario.

Inspirada en el video [Build and Deploy a Full-Stack AI App (Completely Free)](https://www.youtube.com/watch?v=JiwTGGGIhDs) de JavaScript Mastery. Es una implementación propia a partir de la descripción del video: no incluye el código ni los recursos de su kit.

**Tecnologías:** React, TypeScript, Vite, React Router y [Puter.js](https://docs.puter.com/) (autenticación, IA, almacenamiento, hosting y workers, sin servidor propio).

## Cómo ejecutarlo

```bash
npm install
npm run dev
```

Abre la dirección que muestra la terminal. Necesitas una cuenta de Puter; el consumo de IA corre por cuenta de cada usuario.

Para ver la interfaz sin cuenta:

```bash
npm run demo
```

El modo demo guarda todo en memoria y **no usa IA**: el "render" es la misma imagen en sepia. Se pierde al recargar.

```bash
npm test
npm run build
```

## Activar el feed de la comunidad (opcional)

Sin este paso, todo funciona menos la comunidad. Requiere una cuenta de Puter con el correo verificado.

1. Sube `worker/roomify.worker.js` a tu cuenta de Puter.
2. Con la sesión abierta y Puter.js cargado, ejecuta en la consola del navegador:

   ```js
   const d = await puter.workers.create("roomify-api", "roomify.worker.js");
   console.log(d.url);
   ```

3. Crea un archivo `.env` con la URL obtenida, siguiendo `.env.example`:

   ```bash
   VITE_PUTER_WORKER_URL=https://tu-worker.puter.work
   ```

4. Reinicia `npm run dev`.

Para publicar la app, sube el contenido de `dist/` a un hosting estático que redirija todas las rutas a `index.html`.

## Qué se comprobó

- 12 pruebas automáticas de la lógica y del worker, usando un Puter falso.
- Compilación de producción y comprobación de tipos.
- En el navegador, en modo demo: inicio de sesión, rechazo de un PDF, subida, generación y comparador.
- Puter.js real se carga y expone las funciones usadas.

**No se comprobó con una cuenta real de Puter.** Falta confirmar en la práctica el inicio de sesión, la generación con IA, el hosting de imágenes y el worker. Esas llamadas siguen la documentación de Puter de noviembre de 2026. Lo primero que conviene vigilar es `puter_output_path` en `generarRender`.

## Cómo funciona el código

1. **`index.html`** carga Puter.js y arranca React.
2. **[`src/lib/puter.ts`](src/lib/puter.ts)** entrega el Puter real o, en modo demo, [`puterSimulado.ts`](src/lib/puterSimulado.ts).
3. **[`src/contexto.tsx`](src/contexto.tsx)** comparte con toda la app el usuario, el servicio y los errores. `entrar` se llama directamente desde un clic porque abre una ventana emergente.
4. **[`src/App.tsx`](src/App.tsx)** dibuja la barra superior y define las rutas `/` y `/proyecto/:id`.
5. **[`src/pages/Inicio.tsx`](src/pages/Inicio.tsx)** muestra la zona de subida, tus proyectos y la comunidad.
6. **[`src/lib/proyectos.ts`](src/lib/proyectos.ts)** contiene la lógica principal:
   - `validarArchivo` limita el tipo y el tamaño.
   - `obtenerSubdominio` publica una carpeta una sola vez y recuerda su dirección.
   - `crear` sube la imagen y guarda solo su URL y sus datos en KV, porque KV admite 399 KB por valor.
   - `generarRender` envía el plano y las instrucciones al modelo de imagen y guarda el resultado.
   - `cambiarPublicacion` usa `workers.exec`, que envía la sesión del usuario al worker.
7. **[`src/pages/PaginaProyecto.tsx`](src/pages/PaginaProyecto.tsx)** ofrece generar, descargar, publicar y eliminar.
8. **[`src/components/Comparador.tsx`](src/components/Comparador.tsx)** superpone las dos imágenes y recorta la de arriba con `clip-path`, según el deslizador.
9. **[`worker/roomify.worker.js`](worker/roomify.worker.js)** es el único código de servidor. Guarda el feed en la cuenta del dueño (`me.puter`) y comprueba al usuario (`user.puter`). Valida las URL y permite cambiar o borrar una publicación solo a su autor.

### Flujo completo

```text
Archivo → validarArchivo → puter.fs.write → carpeta pública (puter.site)
        → puter.kv.set → /proyecto/:id → puter.ai.txt2img
        → render guardado → comparador → (opcional) worker → feed público
```

## Limitaciones

- El feed no tiene moderación. Revísalo antes de abrirlo a desconocidos.
- Las imágenes de la carpeta publicada son públicas para quien conozca su URL.
- Al eliminar un proyecto se borran sus datos, pero las imágenes siguen en tu carpeta de Puter.
