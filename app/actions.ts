"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureSchema, getSql } from "@/lib/db";

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function saveExtension(form: FormData) {
  const id = text(form, "id");
  const name = text(form, "name");
  const point = text(form, "installation_point");
  const description = text(form, "description") || null;
  if (!id || !name || !point) return;

  await ensureSchema();
  await getSql()`
    INSERT INTO extensions (id, name, installation_point, description)
    VALUES (${id}, ${name}, ${point}, ${description})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      installation_point = EXCLUDED.installation_point,
      description = EXCLUDED.description,
      updated_at = now()`;
  revalidatePath("/");
  redirect(backWith(text(form, "back"), { saved: "1" }));
}

export async function deleteExtension(form: FormData) {
  const id = text(form, "id");
  await ensureSchema();
  await getSql()`DELETE FROM extensions WHERE id = ${id}`;
  revalidatePath("/");
}

export async function installExtension(form: FormData) {
  const id = text(form, "id");
  const siteId = text(form, "site_id");
  if (!id || !siteId) return;
  await ensureSchema();
  await getSql()`
    INSERT INTO site_extensions (site_id, extension_id) VALUES (${siteId}, ${id})
    ON CONFLICT DO NOTHING`;
  revalidatePath("/");
}

export async function uninstallExtension(form: FormData) {
  const id = text(form, "id");
  const siteId = text(form, "site_id");
  await ensureSchema();
  await getSql()`DELETE FROM site_extensions WHERE site_id = ${siteId} AND extension_id = ${id}`;
  revalidatePath("/");
}

export async function purgeLogs(form: FormData) {
  const days = Number(text(form, "older_than_days"));
  const sql = getSql();
  let deleted: number;
  if (Number.isFinite(days) && days > 0) {
    const rows = await sql`
      WITH d AS (DELETE FROM api_logs WHERE created_at < now() - make_interval(days => ${days}::int) RETURNING 1)
      SELECT count(*)::int AS n FROM d`;
    deleted = rows[0].n;
  } else {
    const rows = await sql`WITH d AS (DELETE FROM api_logs RETURNING 1) SELECT count(*)::int AS n FROM d`;
    deleted = rows[0].n;
  }
  revalidatePath("/logs");
  const back = new URLSearchParams(text(form, "context"));
  back.set("purged", String(deleted));
  redirect(`/logs?${back}`);
}

function backWith(back: string, extra: Record<string, string>) {
  const url = new URL(back.startsWith("/") ? back : "/", "http://x");
  for (const k of ["edit", "new", "edit_key", "edit_site", "edit_ext", "edit_env", "saved", "error", "purged"]) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return `${url.pathname}${url.search}`;
}

export async function saveSetting(form: FormData) {
  const back = text(form, "back");
  const key = text(form, "key");
  const value = String(form.get("value") ?? "");
  const siteId = text(form, "site_id");
  const extensionId = text(form, "extension_id");
  const environment = text(form, "environment");
  const scope = text(form, "scope") || null;
  const original = text(form, "original"); // JSON des colonnes de clé si modification

  // En cas d'erreur, on rouvre la modale (ajout ou modification) avec le message.
  const reopen = (error: string) => {
    if (!original) return backWith(back, { error, new: "1" });
    const o = JSON.parse(original);
    return backWith(back, { error, edit_key: o.key, edit_site: o.site_id, edit_ext: o.extension_id, edit_env: o.environment });
  };

  if (!key || !extensionId || !environment || (!siteId && !original)) {
    redirect(reopen("required"));
  }

  const sql = getSql();
  try {
    if (original) {
      const o = JSON.parse(original) as { key: string; site_id: string; extension_id: string; environment: string };
      await sql`
        UPDATE settings SET value = ${value}, scope = ${scope}, updated_at = now()
        WHERE key = ${o.key} AND site_id = ${o.site_id}
          AND extension_id = ${o.extension_id} AND environment = ${o.environment}`;
    } else {
      await sql`
        INSERT INTO settings (key, value, site_id, extension_id, environment, scope, updated_at)
        VALUES (${key}, ${value}, ${siteId}, ${extensionId}, ${environment}, ${scope}, now())`;
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    redirect(reopen(code === "23505" ? "duplicate" : (e as Error).message));
  }
  revalidatePath("/settings");
  revalidatePath("/extensions/[id]/settings", "page");
  redirect(backWith(back, { saved: "1" }));
}
