import sharp from "sharp";
import { ErrorApi } from "./errores.ts";

const FORMATOS = new Set(["png", "jpeg", "webp"]);
const LADO_GUARDADO = 1600;
// La documentación pide entradas menores de 512 x 512 para FLUX.2.
const LADO_REFERENCIA = 511;
const LADO_RENDER = 1024;

/** Comprueba el contenido real del archivo y lo guarda como PNG, sin metadatos como el GPS. */
export async function normalizarPlano(datos: Buffer): Promise<Buffer> {
  let formato: string | undefined;
  try {
    formato = (await sharp(datos).metadata()).format;
  } catch {
    throw new ErrorApi(400, "Usa una imagen PNG, JPG o WEBP válida.");
  }
  if (!formato || !FORMATOS.has(formato)) throw new ErrorApi(400, "Usa una imagen PNG, JPG o WEBP válida.");
  return sharp(datos)
    .rotate()
    .resize(LADO_GUARDADO, LADO_GUARDADO, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

export function crearReferencia(plano: Buffer): Promise<Buffer> {
  return sharp(plano).resize(LADO_REFERENCIA, LADO_REFERENCIA, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

/** Calcula un tamaño de salida con la forma del plano, en múltiplos de 16. */
export async function tamanoRender(plano: Buffer) {
  const { width = 1, height = 1 } = await sharp(plano).metadata();
  const escala = LADO_RENDER / Math.max(width, height);
  const ajustar = (lado: number) => Math.max(256, Math.round((lado * escala) / 16) * 16);
  return { width: ajustar(width), height: ajustar(height) };
}

/** Rechaza respuestas de la IA que no sean una imagen de verdad. */
export async function normalizarRender(datos: Buffer): Promise<Buffer> {
  try {
    return await sharp(datos).png().toBuffer();
  } catch {
    throw new ErrorApi(502, "El servicio de IA no devolvió una imagen válida.");
  }
}
