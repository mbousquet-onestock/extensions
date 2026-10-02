"use client";

import { useState } from "react";

const SECRET_KEY = /token|secret|password|passwd|api_?key|credential/i;

/**
 * Champs clé + valeur d'un setting. Pour une clé sensible (onestock_token…), la valeur se saisit
 * dans un champ masqué et n'est jamais préremplie : vide en modification = valeur actuelle conservée.
 */
export default function SettingKeyValue({
  editing,
  defaultKey,
  defaultValue,
  labels,
}: {
  editing: boolean;
  defaultKey: string;
  defaultValue: string;
  labels: { key: string; value: string; secretHelp: string; secretKeep: string };
}) {
  const [key, setKey] = useState(defaultKey);
  const secret = SECRET_KEY.test(key);

  return (
    <>
      <label className="field full">
        <span className="field-label">{labels.key}</span>
        <input
          className="input mono"
          name="key"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          readOnly={editing}
          autoFocus={!editing}
        />
      </label>
      <label className="field full">
        <span className="field-label">{labels.value}</span>
        {secret ? (
          <>
            <input
              className="input mono"
              type="password"
              name="value"
              autoComplete="new-password"
              required={!editing}
              placeholder={editing ? labels.secretKeep : ""}
              autoFocus={editing}
            />
            <span className="field-help">{labels.secretHelp}</span>
          </>
        ) : (
          <textarea className="textarea" name="value" rows={4} defaultValue={defaultValue} autoFocus={editing} />
        )}
      </label>
    </>
  );
}
