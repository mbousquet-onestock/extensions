"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearLogs } from "@/lib/apiLogs";
import { randomUUID } from "node:crypto";
import { encryptSecret, isSecretKey, MissingKeyError } from "@/lib/secrets";
import { ensureSchema, getSql, isWritableColumn, nameKey, type CatalogInjectionPoint } from "@/lib/db";

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function saveExtension(form: FormData) {
  const back = text(form, "back");
  const id = text(form, "id");
  const name = text(form, "name");
  const editKey = text(form, "edit_key") || id;
  const reopen = (error: string) => backWith(back, editKey ? { error, edit: editKey } : { error, new: "1" });
  if (!name) redirect(reopen("required"));

  let points: CatalogInjectionPoint[] = [];
  try {
    const raw = JSON.parse(String(form.get("injection_points") ?? "[]"));
    points = (Array.isArray(raw) ? raw : [])
      .map((p) => ({
        anchor: String(p.anchor ?? "").trim(),
        name: String(p.name ?? "").trim() || undefined,
        slug: String(p.slug ?? "").trim() || undefined,
        path: String(p.path ?? "").trim() || undefined,
        icon: String(p.icon ?? "").trim() || undefined,
      }))
      .filter((p) => p.anchor);
  } catch {}

  const values = {
    name,
    description: text(form, "description") || null,
    icon: text(form, "icon") || null,
    url: text(form, "url") || null,
    test_url: text(form, "test_url") || null,
    points: JSON.stringify(points),
  };

  await ensureSchema();
  const sql = getSql();
  // Le nom fait le lien avec les extensions installées : il doit être unique dans le catalogue.
  const [dup] = await sql`
    SELECT id FROM extensions WHERE lower(trim(name)) = ${nameKey(name)} AND id <> ${id || ""}`;
  if (dup) redirect(reopen("duplicate_name"));

  if (id) {
    await sql`
      UPDATE extensions SET name = ${values.name}, description = ${values.description}, icon = ${values.icon},
        url = ${values.url}, test_url = ${values.test_url}, injection_points = ${values.points}::jsonb,
        installation_point = ${points[0]?.anchor ?? null}, updated_at = now()
      WHERE id = ${id}`;
  } else {
    await sql`
      INSERT INTO extensions (id, name, description, icon, url, test_url, injection_points, installation_point)
      VALUES (${randomUUID()}, ${values.name}, ${values.description}, ${values.icon}, ${values.url},
        ${values.test_url}, ${values.points}::jsonb, ${points[0]?.anchor ?? null})`;
  }
  revalidatePath("/");
  redirect(backWith(back, { saved: "1" }));
}

export async function deleteExtension(form: FormData) {
  const id = text(form, "id");
  await ensureSchema();
  await getSql()`DELETE FROM extensions WHERE id = ${id}`;
  revalidatePath("/");
}

export async function clearLogsAction(form: FormData) {
  const siteId = text(form, "site_id") || undefined;
  const deleted = await clearLogs(siteId);
  revalidatePath("/logs");
  redirect(backWith(text(form, "back"), { cleared: String(deleted) }));
}

function backWith(back: string, extra: Record<string, string>) {
  const url = new URL(back.startsWith("/") ? back : "/", "http://x");
  for (const k of ["edit", "new", "edit_key", "edit_site", "edit_ext", "edit_env", "saved", "error", "purged", "cleared"]) url.searchParams.delete(k);
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

  // Valeur sensible (onestock_token…) : toujours chiffrée ; vide en modification = valeur actuelle conservée.
  const secret = isSecretKey(original ? JSON.parse(original).key : key);
  if (secret && !value && !original) redirect(reopen("required"));
  let stored = value;
  if (secret && value) {
    try {
      stored = encryptSecret(value);
    } catch (e) {
      redirect(reopen(e instanceof MissingKeyError ? "no_encryption_key" : (e as Error).message));
    }
  }

  const sql = getSql();
  // `scope` peut être une colonne générée (calculée par la base à partir d'extension_id) : on ne l'écrit pas alors.
  const writeScope = await isWritableColumn("settings", "scope");
  try {
    if (original) {
      const o = JSON.parse(original) as { key: string; site_id: string; extension_id: string; environment: string };
      if (secret && !value) {
        await sql.query(
          `UPDATE settings SET ${writeScope ? "scope = $5, " : ""}updated_at = now()
           WHERE key = $1 AND site_id = $2 AND extension_id = $3 AND environment = $4`,
          [o.key, o.site_id, o.extension_id, o.environment, ...(writeScope ? [scope] : [])],
        );
      } else {
        await sql.query(
          `UPDATE settings SET value = $5, ${writeScope ? "scope = $6, " : ""}updated_at = now()
           WHERE key = $1 AND site_id = $2 AND extension_id = $3 AND environment = $4`,
          [o.key, o.site_id, o.extension_id, o.environment, stored, ...(writeScope ? [scope] : [])],
        );
      }
    } else {
      await sql.query(
        `INSERT INTO settings (key, value, site_id, extension_id, environment, ${writeScope ? "scope, " : ""}updated_at)
         VALUES ($1, $2, $3, $4, $5, ${writeScope ? "$6, " : ""}now())`,
        [key, stored, siteId, extensionId, environment, ...(writeScope ? [scope] : [])],
      );
    }
  } catch (e) {
    const code = (e as { code?: string }).code;
    redirect(reopen(code === "23505" ? "duplicate" : (e as Error).message));
  }
  revalidatePath("/settings");
  revalidatePath("/extensions/[id]/settings", "page");
  redirect(backWith(back, { saved: "1" }));
}
