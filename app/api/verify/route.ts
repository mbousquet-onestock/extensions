import { parentOrigin } from "@/lib/onestock";
import { parentSecrets, readExtensionSecret } from "@/lib/settings";
import { checkExtensionSignature } from "@/lib/signature";

export const dynamic = "force-dynamic";

/**
 * POST /api/verify — vérifie extension_signature reçue dans onestock_data.
 * Secrets : le secret hash de l'extension (enregistré à sa création, par extension_id et parent_url),
 * celui saisi pour le parent_url (Settings généraux), puis EXTENSION_SECRETS.
 * Ne renvoie que le statut, jamais de secret.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const origin = parentOrigin(String(body.parent_url ?? ""));
  const extensionId = String(body.extension_id ?? "");
  const fromExtension =
    origin && extensionId ? await readExtensionSecret(origin, extensionId).then((s) => (s?.value ? [s.value] : [])).catch(() => []) : [];
  const fromParent = origin ? await parentSecrets(origin).catch(() => []) : [];
  const fromEnv = (process.env.EXTENSION_SECRETS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const result = checkExtensionSignature(
    String(body.extension_signature ?? ""),
    extensionId,
    String(body.user_id ?? ""),
    [...fromExtension, ...fromParent, ...fromEnv],
  );
  return Response.json(result);
}
