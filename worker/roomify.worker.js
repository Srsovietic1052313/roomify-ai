// API del feed público. Se despliega en Puter (ver README).
// me.puter    = datos del dueño del worker: un solo feed compartido por todos.
// user.puter  = identidad de quien llama; solo existe si usa puter.workers.exec().

const PREFIJO = "feed:";
const URL_VALIDA = /^https:\/\/[a-z0-9-]+\.puter\.site\/[\w.-]+$/i;
const ID_VALIDO = /^[\w-]{1,64}$/;

const json = (datos, status = 200) =>
  new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json" },
  });

router.get("/api/feed", async () => {
  const filas = await me.puter.kv.list(`${PREFIJO}*`, true);
  const publicaciones = filas
    .map((fila) => fila.value)
    .sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn))
    .slice(0, 100)
    .map(({ autorId, ...publica }) => publica); // el id interno del autor no se expone
  return json(publicaciones);
});

router.post("/api/feed", async ({ request, user }) => {
  if (!user?.puter) return json({ error: "Debes iniciar sesión" }, 401);

  const cuerpo = await request.json().catch(() => null);
  const { id, nombre, plantaUrl, renderUrl } = cuerpo ?? {};
  if (
    !ID_VALIDO.test(id ?? "") ||
    typeof nombre !== "string" ||
    !URL_VALIDA.test(plantaUrl ?? "") ||
    !URL_VALIDA.test(renderUrl ?? "")
  ) {
    return json({ error: "Datos no válidos" }, 400);
  }

  const autor = await user.puter.auth.getUser();
  const existente = await me.puter.kv.get(PREFIJO + id);
  if (existente && existente.autorId !== autor.uuid) {
    return json({ error: "No es tu publicación" }, 403);
  }

  await me.puter.kv.set(PREFIJO + id, {
    id,
    nombre: nombre.slice(0, 80),
    plantaUrl,
    renderUrl,
    autor: autor.username,
    autorId: autor.uuid,
    publicadoEn: new Date().toISOString(),
  });
  return json({ ok: true }, 201);
});

router.delete("/api/feed/:id", async ({ params, user }) => {
  if (!user?.puter) return json({ error: "Debes iniciar sesión" }, 401);
  const autor = await user.puter.auth.getUser();
  const existente = await me.puter.kv.get(PREFIJO + params.id);
  if (!existente) return json({ ok: true });
  if (existente.autorId !== autor.uuid) return json({ error: "No es tu publicación" }, 403);
  await me.puter.kv.del(PREFIJO + params.id);
  return json({ ok: true });
});
