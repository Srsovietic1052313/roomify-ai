import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Subida } from "../components/Subida";
import { useApp } from "../contexto";
import type { Proyecto, PublicacionFeed } from "../lib/tipos";

export function Inicio() {
  const { usuario, servicio, entrar } = useApp();
  const navegar = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [feed, setFeed] = useState<PublicacionFeed[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!servicio || !usuario) return setProyectos([]);
    servicio.listar().then(setProyectos).catch(() => setError("No se pudieron cargar tus proyectos."));
  }, [servicio, usuario]);

  useEffect(() => {
    servicio?.feed().then(setFeed).catch(() => setError("No se pudo cargar la comunidad."));
  }, [servicio]);

  const subir = async (archivo: File) => {
    if (!servicio) return;
    setSubiendo(true);
    setError(null);
    try {
      const proyecto = await servicio.crear(archivo);
      navegar(`/proyecto/${proyecto.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el plano.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <>
      <section className="portada">
        <h1>De plano 2D a render 3D</h1>
        <p className="tenue">Sube el plano de una vivienda y la IA creará una vista fotorrealista.</p>
        {usuario ? (
          <Subida ocupado={subiendo} alElegir={subir} />
        ) : (
          <button onClick={entrar}>Inicia sesión para empezar</button>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {usuario && (
        <section>
          <h2>Tus proyectos</h2>
          {proyectos.length === 0 ? (
            <p className="tenue">Todavía no tienes proyectos.</p>
          ) : (
            <div className="rejilla">
              {proyectos.map((p) => (
                <Link key={p.id} to={`/proyecto/${p.id}`} className="tarjeta">
                  <img src={p.renderUrl ?? p.plantaUrl} alt={p.nombre} />
                  <span>{p.nombre}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {servicio?.feedDisponible && (
        <section>
          <h2>Comunidad</h2>
          {feed.length === 0 ? (
            <p className="tenue">Nadie ha publicado todavía.</p>
          ) : (
            <div className="rejilla">
              {feed.map((p) => (
                <article key={p.id} className="tarjeta">
                  <img src={p.renderUrl} alt={p.nombre} />
                  <span>{p.nombre}</span>
                  <small className="tenue">por {p.autor}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
