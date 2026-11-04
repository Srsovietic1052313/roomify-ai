import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface Proyecto {
  id: string;
  nombre: string;
  creadoEn: string;
  plantaArchivo: string;
  renderArchivo: string | null;
}

const COLUMNAS = `id, nombre, creado_en AS creadoEn, planta_archivo AS plantaArchivo, render_archivo AS renderArchivo`;

export function abrirBase(ruta: string) {
  if (ruta !== ":memory:") mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`CREATE TABLE IF NOT EXISTS proyectos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    creado_en TEXT NOT NULL,
    planta_archivo TEXT NOT NULL,
    render_archivo TEXT
  )`);
  return db;
}

export function crearRepositorio(db: DatabaseSync) {
  return {
    insertar(p: Proyecto) {
      db.prepare("INSERT INTO proyectos (id, nombre, creado_en, planta_archivo, render_archivo) VALUES (?, ?, ?, ?, ?)")
        .run(p.id, p.nombre, p.creadoEn, p.plantaArchivo, p.renderArchivo);
    },
    listar() {
      return db.prepare(`SELECT ${COLUMNAS} FROM proyectos ORDER BY creado_en DESC`).all() as unknown as Proyecto[];
    },
    obtener(id: string) {
      return (db.prepare(`SELECT ${COLUMNAS} FROM proyectos WHERE id = ?`).get(id) as unknown as Proyecto) ?? null;
    },
    guardarRender(id: string, archivo: string) {
      db.prepare("UPDATE proyectos SET render_archivo = ? WHERE id = ?").run(archivo, id);
    },
    eliminar(id: string) {
      db.prepare("DELETE FROM proyectos WHERE id = ?").run(id);
    },
  };
}

export type Repositorio = ReturnType<typeof crearRepositorio>;
