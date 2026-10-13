export function origemPublica(request: Request) {
  const bruto = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const host = bruto.split(",")[0]?.trim() ?? "";
  const protocoloBruto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocolo =
    protocoloBruto === "http" || protocoloBruto === "https"
      ? protocoloBruto
      : new URL(request.url).protocol === "https:"
        ? "https"
        : "http";
  if (/^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) return `${protocolo}://${host}`;
  return new URL(request.url).origin;
}
