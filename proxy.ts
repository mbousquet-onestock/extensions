import { NextResponse, type NextRequest } from "next/server";

// Authentification basique optionnelle : active uniquement si ADMIN_PASSWORD est défini.
export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [, pass] = atob(encoded).split(":");
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentification requise", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="extensions"' },
  });
}

// L'API settings a sa propre authentification (clé d'API) : exclue de l'authentification basique.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/settings).*)"] };
