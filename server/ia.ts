import sharp from "sharp";
import { ErrorApi } from "./errores.ts";

export const PROMPT_RENDER = `Convert the floor plan in image 0 into a photorealistic 3D top-down render of the same home.
Keep the exact layout: walls, rooms, doors, windows and proportions must match the plan.
Furnish each room according to its apparent purpose, with realistic materials, soft natural light and soft shadows.
Remove all text, dimensions and annotations. Use an orthographic top-down view with the roof removed.`;

export const MODELO_POR_DEFECTO = "@cf/black-forest-labs/flux-2-dev";

export interface PedidoRender {
  referencia: Buffer;
  width: number;
  height: number;
}

export interface ProveedorIa {
  nombre: "cloudflare" | "simulado";
  configurado: boolean;
  generar(pedido: PedidoRender): Promise<Buffer>;
}

interface OpcionesCloudflare {
  cuenta?: string;
  token?: string;
  modelo?: string;
  fetch?: typeof fetch;
}

export function crearCloudflare({ cuenta, token, modelo = MODELO_POR_DEFECTO, fetch: pedir = fetch }: OpcionesCloudflare): ProveedorIa {
  return {
    nombre: "cloudflare",
    configurado: Boolean(cuenta && token),

    async generar({ referencia, width, height }) {
      if (!cuenta || !token) throw new ErrorApi(503, "Falta configurar Cloudflare en el archivo .env.");

      const formulario = new FormData();
      formulario.append("prompt", PROMPT_RENDER);
      formulario.append("input_image_0", new Blob([new Uint8Array(referencia)], { type: "image/png" }), "plano.png");
      formulario.append("steps", "20");
      formulario.append("width", String(width));
      formulario.append("height", String(height));

      let respuesta: Response;
      try {
        respuesta = await pedir(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cuenta)}/ai/run/${modelo}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formulario,
          signal: AbortSignal.timeout(180_000),
        });
      } catch {
        throw new ErrorApi(504, "Cloudflare tardó demasiado o no se pudo conectar. Inténtalo de nuevo.");
      }

      if (respuesta.status === 401 || respuesta.status === 403) {
        throw new ErrorApi(502, "Cloudflare rechazó las credenciales. Revisa tu cuenta y tu token en .env.");
      }
      if (respuesta.status === 429) {
        throw new ErrorApi(429, "Se alcanzó el límite de Cloudflare. Espera un momento o prueba mañana.");
      }
      const cuerpo = (await respuesta.json().catch(() => null)) as CuerpoCloudflare | null;
      if (!respuesta.ok) {
        console.error("Error de Cloudflare:", respuesta.status, cuerpo?.errors);
        throw new ErrorApi(502, "Cloudflare no pudo generar la imagen. Inténtalo de nuevo.");
      }
      const imagen = cuerpo?.result?.image ?? cuerpo?.image;
      if (typeof imagen !== "string" || !imagen) {
        throw new ErrorApi(502, "La respuesta de Cloudflare no incluía una imagen.");
      }
      return Buffer.from(imagen, "base64");
    },
  };
}

interface CuerpoCloudflare {
  result?: { image?: unknown };
  image?: unknown;
  errors?: unknown;
}

/** Para `npm run demo`: no llama a ninguna IA, solo cambia el color del plano. */
export function crearSimulado(): ProveedorIa {
  return {
    nombre: "simulado",
    configurado: true,
    generar: ({ referencia, width, height }) =>
      sharp(referencia).resize(width, height, { fit: "fill" }).tint({ r: 214, g: 170, b: 120 }).png().toBuffer(),
  };
}
