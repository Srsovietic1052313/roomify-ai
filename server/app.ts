import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { Proyecto, Repositorio } from "./db.ts";
import { ErrorApi } from "./errores.ts";
import type { ProveedorIa } from "./ia.ts";
import { crearReferencia, normalizarPlano, normalizarRender, tamanoRender } from "./imagenes.ts";

const TAMANO_MAXIMO = 10 * 1024 * 1024;
const HOSTS_LOCALES = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export interface DatosAjustes {
  cuenta: string;
  /** Vacío o ausente: conserva el token guardado. */
  token?: string;
  demo: boolean;
}

/** Solo existe en la app de escritorio, donde las credenciales se guardan cifradas. */
export interface Ajustes {
  leer(): { cuenta: string; tokenGuardado: boolean; demo: boolean };
  guardar(datos: DatosAjustes): void;
}

interface Dependencias {
  repositorio: Repositorio;
  carpetaImagenes: string;
  obtenerIa: () => ProveedorIa;
  carpetaWeb?: string;
  ajustes?: Ajustes;
}

const paraCliente = (p: Proyecto) => ({
  id: p.id,
  nombre: p.nombre,
  creadoEn: p.creadoEn,
  plantaUrl: `/imagenes/${p.plantaArchivo}`,
  renderUrl: p.renderArchivo ? `/imagenes/${p.renderArchivo}` : null,
});

/** Esta app no tiene cuentas: solo admite peticiones de esta computadora y de su propia página. */
function soloLocal(peticion: Request, respuesta: Response, siguiente: NextFunction) {
  const host = peticion.headers.host ?? "";
  const origen = peticion.headers.origin;
  let origenValido = true;
  if (origen) {
    try {
      origenValido = new URL(origen).host === host;
    } catch {
      origenValido = false;
    }
  }
  if (!HOSTS_LOCALES.test(host) || !origenValido) {
    respuesta.status(403).json({ error: "Petición no permitida." });
    return;
  }
  siguiente();
}

export function crearApp({ repositorio, carpetaImagenes, obtenerIa, carpetaWeb, ajustes }: Dependencias) {
  const app = express();
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAMANO_MAXIMO, files: 1 } });

  const obtenerProyecto = (id: string) => {
    const proyecto = repositorio.obtener(id);
    if (!proyecto) throw new ErrorApi(404, "Este proyecto no existe.");
    return proyecto;
  };

  app.disable("x-powered-by");
  app.use(soloLocal);
  app.use("/imagenes", express.static(carpetaImagenes, { fallthrough: false, immutable: true, maxAge: "1y", setHeaders: (r) => r.setHeader("X-Content-Type-Options", "nosniff") }));

  app.get("/api/estado", (_peticion, respuesta) => {
    const ia = obtenerIa();
    respuesta.json({ proveedor: ia.nombre, configurado: ia.configurado, escritorio: Boolean(ajustes) });
  });

  app.get("/api/ajustes", (_peticion, respuesta) => {
    if (!ajustes) throw new ErrorApi(404, "Ruta no encontrada.");
    respuesta.json(ajustes.leer());
  });

  app.put("/api/ajustes", express.json({ limit: "10kb" }), (peticion, respuesta) => {
    if (!ajustes) throw new ErrorApi(404, "Ruta no encontrada.");
    const { cuenta, token, demo } = peticion.body ?? {};
    if (typeof cuenta !== "string" || cuenta.length > 100 || (cuenta && !/^[a-f0-9]+$/i.test(cuenta.trim()))) {
      throw new ErrorApi(400, "El Account ID no parece válido.");
    }
    if (token !== undefined && (typeof token !== "string" || token.length > 500)) {
      throw new ErrorApi(400, "El token no parece válido.");
    }
    ajustes.guardar({ cuenta: cuenta.trim(), token: token?.trim(), demo: demo === true });
    respuesta.json(ajustes.leer());
  });

  app.get("/api/proyectos", (_peticion, respuesta) => {
    respuesta.json(repositorio.listar().map(paraCliente));
  });

  app.get("/api/proyectos/:id", (peticion, respuesta) => {
    respuesta.json(paraCliente(obtenerProyecto(peticion.params.id)));
  });

  app.post("/api/proyectos", subida.single("plano"), async (peticion, respuesta) => {
    if (!peticion.file) throw new ErrorApi(400, "Elige una imagen.");
    const plano = await normalizarPlano(peticion.file.buffer);

    await mkdir(carpetaImagenes, { recursive: true });
    const id = randomUUID();
    const plantaArchivo = `${id}-planta.png`;
    await writeFile(path.join(carpetaImagenes, plantaArchivo), plano);

    // multer entrega el nombre como latin1; así se recuperan los acentos.
    const original = Buffer.from(peticion.file.originalname, "latin1").toString("utf8");
    const proyecto: Proyecto = {
      id,
      nombre: original.replace(/\.[^.]+$/, "").trim().slice(0, 80) || "Sin nombre",
      creadoEn: new Date().toISOString(),
      plantaArchivo,
      renderArchivo: null,
    };
    repositorio.insertar(proyecto);
    respuesta.status(201).json(paraCliente(proyecto));
  });

  app.post("/api/proyectos/:id/render", async (peticion, respuesta) => {
    const proyecto = obtenerProyecto(peticion.params.id);
    const ia = obtenerIa();
    if (!ia.configurado) throw new ErrorApi(503, "Falta configurar el servicio de IA.");

    const plano = await readFile(path.join(carpetaImagenes, proyecto.plantaArchivo));
    const resultado = await ia.generar({ referencia: await crearReferencia(plano), ...(await tamanoRender(plano)) });
    const render = await normalizarRender(resultado);

    // Nombre nuevo en cada generación: el navegador no mostrará una copia vieja.
    const renderArchivo = `${proyecto.id}-render-${Date.now()}.png`;
    await writeFile(path.join(carpetaImagenes, renderArchivo), render);
    repositorio.guardarRender(proyecto.id, renderArchivo);
    if (proyecto.renderArchivo) await rm(path.join(carpetaImagenes, proyecto.renderArchivo), { force: true });

    respuesta.json(paraCliente(obtenerProyecto(proyecto.id)));
  });

  app.delete("/api/proyectos/:id", async (peticion, respuesta) => {
    const proyecto = obtenerProyecto(peticion.params.id);
    repositorio.eliminar(proyecto.id);
    for (const archivo of [proyecto.plantaArchivo, proyecto.renderArchivo]) {
      if (archivo) await rm(path.join(carpetaImagenes, archivo), { force: true });
    }
    respuesta.status(204).end();
  });

  app.use("/api", (_peticion, _respuesta, siguiente) => siguiente(new ErrorApi(404, "Ruta no encontrada.")));

  if (carpetaWeb && existsSync(carpetaWeb)) {
    app.use(express.static(carpetaWeb));
    app.get(/.*/, (_peticion, respuesta) => respuesta.sendFile(path.join(carpetaWeb, "index.html")));
  }

  app.use((error: unknown, _peticion: Request, respuesta: Response, siguiente: NextFunction) => {
    if (respuesta.headersSent) return siguiente(error);
    if (error instanceof ErrorApi) {
      respuesta.status(error.status).json({ error: error.message });
    } else if (error instanceof multer.MulterError) {
      const mensaje = error.code === "LIMIT_FILE_SIZE" ? "La imagen no puede superar los 10 MB." : "No se pudo leer el archivo.";
      respuesta.status(400).json({ error: mensaje });
    } else if ((error as { status?: number }).status === 404) {
      respuesta.status(404).json({ error: "Imagen no encontrada." });
    } else {
      console.error(error);
      respuesta.status(500).json({ error: "Error interno del servidor." });
    }
  });

  return app;
}
