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
  const back = text(form, "back");
  if (back.startsWith("/")) redirect(back);
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
