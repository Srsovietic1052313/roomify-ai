import type { Proyecto, PublicacionFeed, PuterApi } from "./tipos";

export const TIPOS_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"];
export const TAMANO_MAXIMO = 10 * 1024 * 1024;
export const CARPETA_IMAGENES = "roomify-imagenes";
const CLAVE_HOSTING = "hosting:subdominio";
const PREFIJO = "proyecto:";

export const MODELO_IMAGEN = "gemini-3.1-flash-image";
export const PROMPT_RENDER = `Convert this 2D architectural floor plan into a photorealistic 3D top-down render of the same home.
Keep the exact layout: walls, rooms, doors, windows and proportions must match the plan.
Furnish each room according to its apparent purpose, with realistic materials, soft natural light and soft shadows.
Remove all text, dimensions and annotations. Use an orthographic top-down view with the roof removed.`;

export function validarArchivo(archivo: { type: string; size: number }): string | null {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) return "Usa una imagen PNG, JPG o WEBP.";
  if (archivo.size > TAMANO_MAXIMO) return "La imagen no puede superar los 10 MB.";
  if (archivo.size === 0) return "El archivo está vacío.";
  return null;
}

const extension = (tipo: string) =>
  ({ "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[tipo] ?? "png";

/** Publica la carpeta de imágenes una sola vez y recuerda su subdominio. */
export async function obtenerSubdominio(puter: PuterApi): Promise<string> {
  const guardado = await puter.kv.get<string>(CLAVE_HOSTING);
  if (guardado) return guardado;
  await puter.fs.mkdir(CARPETA_IMAGENES, { createMissingParents: true }).catch(() => {
    // Ya existe: no es un problema.
  });
  const sufijo = crypto.randomUUID().slice(0, 12);
  const sitio = await puter.hosting.create(`roomify-${sufijo}`, CARPETA_IMAGENES);
  await puter.kv.set(CLAVE_HOSTING, sitio.subdomain);
  return sitio.subdomain;
}

function aDataUrl(blob: Blob) {
  return new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));
    lector.readAsDataURL(blob);
  });
}

async function subirImagen(puter: PuterApi, blob: Blob, nombre: string, simulado: boolean): Promise<string> {
  if (simulado) return aDataUrl(blob);
  const subdominio = await obtenerSubdominio(puter);
  await puter.fs.write(`${CARPETA_IMAGENES}/${nombre}`, blob, { createMissingParents: true });
  return `https://${subdominio}.puter.site/${nombre}`;
}

export interface OpcionesServicio {
  simulado?: boolean;
  urlWorker?: string;
}

export function crearServicio(puter: PuterApi, { simulado = false, urlWorker = "" }: OpcionesServicio = {}) {
  const guardar = async (proyecto: Proyecto) => {
    await puter.kv.set(PREFIJO + proyecto.id, proyecto);
    return proyecto;
  };

  const cambiarPublicacion = async (proyecto: Proyecto, publico: boolean): Promise<Proyecto> => {
    if (!urlWorker) throw new Error("El feed no está configurado.");
    if (publico && !proyecto.renderUrl) throw new Error("Genera el render antes de publicar.");
    const respuesta = await puter.workers.exec(
      publico ? `${urlWorker}/api/feed` : `${urlWorker}/api/feed/${proyecto.id}`,
      publico
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: proyecto.id,
              nombre: proyecto.nombre,
              plantaUrl: proyecto.plantaUrl,
              renderUrl: proyecto.renderUrl,
            }),
          }
        : { method: "DELETE" },
    );
    if (!respuesta.ok) throw new Error("No se pudo actualizar la publicación.");
    return guardar({ ...proyecto, publico });
  };

  return {
    feedDisponible: Boolean(urlWorker),
    cambiarPublicacion,

    async crear(archivo: File): Promise<Proyecto> {
      const error = validarArchivo(archivo);
      if (error) throw new Error(error);
      const id = crypto.randomUUID();
      const plantaUrl = await subirImagen(puter, archivo, `${id}-planta.${extension(archivo.type)}`, simulado);
      return guardar({
        id,
        nombre: archivo.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Sin nombre",
        creadoEn: new Date().toISOString(),
        plantaUrl,
        renderUrl: null,
        publico: false,
      });
    },

    async listar(): Promise<Proyecto[]> {
      const filas = await puter.kv.list(`${PREFIJO}*`, true);
      return filas
        .map((fila) => fila.value as Proyecto)
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    },

    obtener: (id: string) => puter.kv.get<Proyecto>(PREFIJO + id),

    /** Pide el render a la IA y lo guarda. El resultado queda en la carpeta publicada. */
    async generarRender(proyecto: Proyecto): Promise<Proyecto> {
      const nombre = `${proyecto.id}-render.png`;
      const opciones: Record<string, unknown> = {
        model: MODELO_IMAGEN,
        input_image: proyecto.plantaUrl,
      };
      if (!simulado) opciones.puter_output_path = `${CARPETA_IMAGENES}/${nombre}`;
      const imagen = await puter.ai.txt2img(PROMPT_RENDER, opciones);
      const renderUrl = simulado
        ? imagen.src
        : `https://${await obtenerSubdominio(puter)}.puter.site/${nombre}`;
      return guardar({ ...proyecto, renderUrl });
    },

    async eliminar(proyecto: Proyecto) {
      if (proyecto.publico) await cambiarPublicacion(proyecto, false);
      await puter.kv.del(PREFIJO + proyecto.id);
    },

    async feed(): Promise<PublicacionFeed[]> {
      if (!urlWorker) return [];
      const respuesta = await fetch(`${urlWorker}/api/feed`);
      if (!respuesta.ok) throw new Error("No se pudo cargar la comunidad.");
      return respuesta.json();
    },
  };
}

export type ServicioProyectos = ReturnType<typeof crearServicio>;
