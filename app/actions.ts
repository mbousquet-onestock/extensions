"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function saveExtension(form: FormData) {
  const id = text(form, "id");
  const name = text(form, "name");
  const point = text(form, "installation_point");
  const settingsUrl = text(form, "settings_url") || null;
  const installed = form.get("installed") === "on";
  if (!id || !name || !point) return;

  await getSql()`
    INSERT INTO extensions (id, name, installation_point, installed, settings_url)
    VALUES (${id}, ${name}, ${point}, ${installed}, ${settingsUrl})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      installation_point = EXCLUDED.installation_point,
      installed = EXCLUDED.installed,
      settings_url = EXCLUDED.settings_url,
      updated_at = now()`;
  revalidatePath("/");
}

export async function toggleInstalled(form: FormData) {
  const id = text(form, "id");
  await getSql()`
    UPDATE extensions SET installed = NOT installed, updated_at = now() WHERE id = ${id}`;
  revalidatePath("/");
}

export async function deleteExtension(form: FormData) {
  const id = text(form, "id");
  await getSql()`DELETE FROM extensions WHERE id = ${id}`;
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
  redirect(`/logs?purged=${deleted}`);
}
