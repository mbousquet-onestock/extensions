"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogInjectionPoint } from "@/lib/db";
import { Icon } from "@/components/ui";

const MAX_ICON_BYTES = 100 * 1024; // limite OneStock : 100 Ko (PNG, JPG, GIF)

export type ExtensionFormValues = {
  id?: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  test_url: string;
  injection_points: CatalogInjectionPoint[];
};

export type ExtensionFormLabels = Record<
  | "name" | "description" | "icon" | "url" | "testUrl" | "points" | "anchor" | "pointName" | "slug" | "path"
  | "addPoint" | "removePoint" | "chooseIcon" | "removeIcon" | "iconHelp" | "iconTooBig" | "nameHelp"
  | "cancel" | "save" | "create" | "noPoints",
  string
>;

function iconPreview(icon: string) {
  if (!icon) return null;
  if (icon.startsWith("data:") || icon.startsWith("http")) return icon;
  const type = icon.startsWith("iVBOR") ? "png" : icon.startsWith("R0lGOD") ? "gif" : icon.startsWith("PHN2") ? "svg+xml" : "jpeg";
  return `data:image/${type};base64,${icon}`;
}

/** Champ icône : lit le fichier et le stocke en base64 (sans préfixe data:, comme l'API OneStock). */
function IconInput({
  value,
  onChange,
  labels,
  small,
}: {
  value: string;
  onChange: (v: string) => void;
  labels: ExtensionFormLabels;
  small?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const src = iconPreview(value);
  return (
    <div className="icon-input">
      <span className={`ext-icon${small ? "" : " large"}${src ? "" : " placeholder"}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" />
        ) : (
          <Icon name="cube" />
        )}
      </span>
      <label className="btn btn-secondary btn-small">
        {labels.chooseIcon}
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > MAX_ICON_BYTES) {
              setError(labels.iconTooBig);
              return;
            }
            setError(null);
            const reader = new FileReader();
            reader.onload = () => onChange(String(reader.result).replace(/^data:[^,]*,/, ""));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {value && (
        <button type="button" className="btn btn-tertiary btn-small" onClick={() => onChange("")}>
          {labels.removeIcon}
        </button>
      )}
      {!small && <span className="field-help">{error ?? labels.iconHelp}</span>}
      {small && error && <span className="field-help" style={{ color: "var(--red-1000)" }}>{error}</span>}
    </div>
  );
}

export default function ExtensionForm({
  action,
  initial,
  back,
  editKey,
  anchors,
  labels,
}: {
  action: (form: FormData) => Promise<void>;
  initial: ExtensionFormValues;
  back: string;
  editKey?: string;
  anchors: string[];
  labels: ExtensionFormLabels;
}) {
  const [icon, setIcon] = useState(initial.icon);
  const [points, setPoints] = useState<CatalogInjectionPoint[]>(
    initial.injection_points.length ? initial.injection_points : [{ anchor: "", name: "", slug: "", path: "/" }],
  );
  const update = (i: number, patch: Partial<CatalogInjectionPoint>) =>
    setPoints((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <form action={action}>
      <input type="hidden" name="back" value={back} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {editKey && <input type="hidden" name="edit_key" value={editKey} />}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="injection_points" value={JSON.stringify(points)} />

      <div className="modal-body">
        <div className="form-grid">
          <label className="field full">
            <span className="field-label">{labels.name}</span>
            <input className="input" name="name" required defaultValue={initial.name} autoFocus />
            <span className="field-help">{labels.nameHelp}</span>
          </label>
          <div className="field full">
            <span className="field-label">{labels.icon}</span>
            <IconInput value={icon} onChange={setIcon} labels={labels} />
          </div>
          <label className="field">
            <span className="field-label">{labels.url}</span>
            <input className="input mono" name="url" type="url" placeholder="https://" defaultValue={initial.url} />
          </label>
          <label className="field">
            <span className="field-label">{labels.testUrl}</span>
            <input className="input mono" name="test_url" type="url" placeholder="https://" defaultValue={initial.test_url} />
          </label>
          <label className="field full">
            <span className="field-label">{labels.description}</span>
            <textarea className="textarea" style={{ fontFamily: "inherit", minHeight: 60 }} name="description" rows={2} defaultValue={initial.description} />
          </label>
        </div>

        <div className="points">
          <div className="points-head">
            <span className="field-label" style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              {labels.points}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setPoints((ps) => [...ps, { anchor: "", name: "", slug: "", path: "/" }])}
            >
              <Icon name="plus" />
              {labels.addPoint}
            </button>
          </div>
          {points.length === 0 && <p className="secondary" style={{ margin: 0 }}>{labels.noPoints}</p>}
          {points.map((p, i) => (
            <div className="point-card" key={i}>
              <div className="point-grid">
                <label className="field">
                  <span className="field-label">{labels.anchor}</span>
                  <input
                    className="input mono"
                    list="anchors"
                    value={p.anchor}
                    placeholder="bo.page"
                    onChange={(e) => update(i, { anchor: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">{labels.pointName}</span>
                  <input className="input" value={p.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} />
                </label>
                <label className="field">
                  <span className="field-label">{labels.slug}</span>
                  <input className="input mono" value={p.slug ?? ""} onChange={(e) => update(i, { slug: e.target.value })} />
                </label>
                <label className="field">
                  <span className="field-label">{labels.path}</span>
                  <input className="input mono" value={p.path ?? ""} placeholder="/" onChange={(e) => update(i, { path: e.target.value })} />
                </label>
              </div>
              <div className="point-foot">
                <IconInput small value={p.icon ?? ""} onChange={(v) => update(i, { icon: v })} labels={labels} />
                <button
                  type="button"
                  className="btn btn-icon danger"
                  title={labels.removePoint}
                  aria-label={labels.removePoint}
                  onClick={() => setPoints((ps) => ps.filter((_, j) => j !== i))}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
          <datalist id="anchors">
            {anchors.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
      </div>
      <div className="modal-footer">
        <Link href={back} className="btn btn-secondary" scroll={false}>{labels.cancel}</Link>
        <button className="btn btn-primary" type="submit">{initial.id ? labels.save : labels.create}</button>
      </div>
    </form>
  );
}
