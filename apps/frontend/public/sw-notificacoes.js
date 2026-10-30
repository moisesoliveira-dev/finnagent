// Service worker do push das notificações. Mostra o aviso que o backend mandou e, no clique,
// leva para a tela dele (o `url` vem pronto do backend): foca uma aba do Prumo já aberta ou abre uma nova.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let carga = {};
  try {
    carga = evento.data ? evento.data.json() : {};
  } catch {
    carga = { titulo: "Prumo", texto: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    Promise.all([
      self.registration.showNotification(carga.titulo || "Prumo", {
        body: carga.texto || "",
        icon: "/icon.png",
        badge: "/icon.png",
        // A mesma notificação chegando de novo substitui a anterior em vez de empilhar.
        tag: carga.id,
        data: { url: typeof carga.url === "string" && carga.url.startsWith("/") ? carga.url : "/" },
      }),
      // As abas abertas atualizam o sino na hora.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((abas) => abas.forEach((aba) => aba.postMessage({ tipo: "notificacao" }))),
    ]),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url || "/", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      const aberta = abas.find((aba) => new URL(aba.url).origin === self.location.origin);
      if (aberta) return aberta.navigate(url).then((aba) => (aba || aberta).focus());
      return self.clients.openWindow(url);
    }),
  );
});
