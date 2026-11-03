import { parentOrigin } from "@/lib/onestock";
import { parentSecrets } from "@/lib/settings";
import { checkExtensionSignature } from "@/lib/signature";

export const dynamic = "force-dynamic";

/**
 * POST /api/verify — vérifie extension_signature reçue dans onestock_data.
 * Secrets : celui du parent_url (Settings généraux → Token OneStock), puis EXTENSION_SECRETS.
 * Ne renvoie que le statut, jamais de secret.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const origin = parentOrigin(String(body.parent_url ?? ""));
  const fromParent = origin ? await parentSecrets(origin).catch(() => []) : [];
  const fromEnv = (process.env.EXTENSION_SECRETS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const result = checkExtensionSignature(
    String(body.extension_signature ?? ""),
    String(body.extension_id ?? ""),
    String(body.user_id ?? ""),
    [...fromParent, ...fromEnv],
  );
  return Response.json(result);
}
