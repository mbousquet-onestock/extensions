import { checkExtensionSignature } from "@/lib/signature";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = checkExtensionSignature(
    String(body.extension_signature ?? ""),
    String(body.extension_id ?? ""),
    String(body.user_id ?? ""),
  );
  return Response.json(result);
}
