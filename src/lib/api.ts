import type { EstadoIa, Proyecto } from "./tipos";

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(ruta, opciones);
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(cuerpo?.error ?? "No se pudo conectar con el servidor.");
  }
  return (respuesta.status === 204 ? null : await respuesta.json()) as T;
}

export const api = {
  estado: () => pedir<EstadoIa>("/api/estado"),
  listar: () => pedir<Proyecto[]>("/api/proyectos"),
  obtener: (id: string) => pedir<Proyecto>(`/api/proyectos/${id}`),
  crear: (archivo: File) => {
    const formulario = new FormData();
    formulario.append("plano", archivo);
    return pedir<Proyecto>("/api/proyectos", { method: "POST", body: formulario });
  },
  generarRender: (id: string) => pedir<Proyecto>(`/api/proyectos/${id}/render`, { method: "POST" }),
  eliminar: (id: string) => pedir<void>(`/api/proyectos/${id}`, { method: "DELETE" }),
};
