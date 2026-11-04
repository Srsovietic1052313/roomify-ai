import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Comparador } from "../components/Comparador";
import { useApp } from "../contexto";
import type { Proyecto } from "../lib/tipos";

export function PaginaProyecto() {
  const { id = "" } = useParams();
  const { usuario, servicio, cargando } = useApp();
  const navegar = useNavigate();
  const [proyecto, setProyecto] = useState<Proyecto | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!servicio || !usuario) return;
    servicio.obtener(id).then(setProyecto).catch(() => setError("No se pudo cargar el proyecto."));
  }, [servicio, usuario, id]);

  if (!cargando && !usuario) return <p>Inicia sesión para ver este proyecto.</p>;
  if (proyecto === undefined) return error ? <p className="error">{error}</p> : <p>Cargando…</p>;
  if (proyecto === null) return <p>Este proyecto no existe. <Link to="/">Volver</Link></p>;

  const ejecutar = async (accion: () => Promise<Proyecto>, mensaje: string) => {
    setOcupado(true);
    setError(null);
    try {
      setProyecto(await accion());
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : mensaje);
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    if (!servicio || !confirm(`¿Eliminar «${proyecto.nombre}»?`)) return;
    setOcupado(true);
    try {
      await servicio.eliminar(proyecto);
      navegar("/");
    } catch {
      setError("No se pudo eliminar el proyecto.");
      setOcupado(false);
    }
  };

  return (
    <section>
      <h1>{proyecto.nombre}</h1>
      {proyecto.renderUrl ? (
        <Comparador antes={proyecto.plantaUrl} despues={proyecto.renderUrl} />
      ) : (
        <img className="plano" src={proyecto.plantaUrl} alt="Plano original" />
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="acciones">
        <button
          disabled={ocupado}
          onClick={() => ejecutar(() => servicio!.generarRender(proyecto), "La IA no pudo generar la imagen.")}
        >
          {ocupado ? "Trabajando…" : proyecto.renderUrl ? "Generar otra vez" : "Generar render 3D"}
        </button>
        {proyecto.renderUrl && (
          <a className="boton secundario" href={proyecto.renderUrl} download={`${proyecto.nombre}.png`} target="_blank" rel="noreferrer">
            Descargar
          </a>
        )}
        {servicio?.feedDisponible && proyecto.renderUrl && (
          <button
            className="secundario"
            disabled={ocupado}
            onClick={() =>
              ejecutar(() => servicio.cambiarPublicacion(proyecto, !proyecto.publico), "No se pudo actualizar la publicación.")
            }
          >
            {proyecto.publico ? "Quitar de la comunidad" : "Publicar en la comunidad"}
          </button>
        )}
        <button className="secundario peligro" disabled={ocupado} onClick={eliminar}>Eliminar</button>
      </div>
    </section>
  );
}
