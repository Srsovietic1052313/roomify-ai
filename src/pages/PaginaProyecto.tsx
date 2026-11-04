import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Comparador } from "../components/Comparador";
import { api } from "../lib/api";
import type { Proyecto } from "../lib/tipos";

export function PaginaProyecto({ iaLista }: { iaLista: boolean }) {
  const { id = "" } = useParams();
  const navegar = useNavigate();
  const [proyecto, setProyecto] = useState<Proyecto | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.obtener(id).then(setProyecto).catch(() => setProyecto(null));
  }, [id]);

  if (proyecto === undefined) return <p>Cargando…</p>;
  if (proyecto === null) return <p>Este proyecto no existe. <Link to="/">Volver</Link></p>;

  const generar = async () => {
    setOcupado(true);
    setError(null);
    try {
      setProyecto(await api.generarRender(proyecto.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    if (!confirm(`¿Eliminar «${proyecto.nombre}»?`)) return;
    setOcupado(true);
    try {
      await api.eliminar(proyecto.id);
      navegar("/");
    } catch (e) {
      setError((e as Error).message);
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
        <button disabled={ocupado || !iaLista} onClick={generar}>
          {ocupado ? "Trabajando…" : proyecto.renderUrl ? "Generar otra vez" : "Generar render 3D"}
        </button>
        {proyecto.renderUrl && (
          <a className="boton secundario" href={proyecto.renderUrl} download={`${proyecto.nombre}.png`}>
            Descargar
          </a>
        )}
        <button className="secundario peligro" disabled={ocupado} onClick={eliminar}>Eliminar</button>
      </div>
    </section>
  );
}
