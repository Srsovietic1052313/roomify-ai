import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Subida } from "../components/Subida";
import { api } from "../lib/api";
import type { Proyecto } from "../lib/tipos";

export function Inicio() {
  const navegar = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listar().then(setProyectos).catch((e: Error) => setError(e.message));
  }, []);

  const subir = async (archivo: File) => {
    setSubiendo(true);
    setError(null);
    try {
      const proyecto = await api.crear(archivo);
      navegar(`/proyecto/${proyecto.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <>
      <section className="portada">
        <h1>De plano 2D a render 3D</h1>
        <p className="tenue">Sube el plano de una vivienda y la IA creará una vista fotorrealista.</p>
        <Subida ocupado={subiendo} alElegir={subir} />
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <section>
        <h2>Tus proyectos</h2>
        {proyectos?.length === 0 && <p className="tenue">Todavía no tienes proyectos.</p>}
        <div className="rejilla">
          {proyectos?.map((p) => (
            <Link key={p.id} to={`/proyecto/${p.id}`} className="tarjeta">
              <img src={p.renderUrl ?? p.plantaUrl} alt={p.nombre} />
              <span>{p.nombre}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
