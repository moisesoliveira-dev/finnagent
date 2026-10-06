const tenantId = "00000000-0000-4000-8000-000000000001";

export async function callBackend(path: string, init?: RequestInit) {
  const base = process.env.API_URL;
  if (!base) {
    return Response.json(
      { message: "API_URL não está definida." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(new URL(path, base.endsWith("/") ? base : `${base}/`), {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-tenant-id": tenantId,
        ...init?.headers,
      },
      cache: "no-store",
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { message: "O backend não respondeu." },
      { status: 503 },
    );
  }
}
