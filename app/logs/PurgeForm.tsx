"use client";

import { purgeLogs } from "../actions";

export default function PurgeForm({ canFilterByDate }: { canFilterByDate: boolean }) {
  return (
    <form
      action={purgeLogs}
      className="row"
      onSubmit={(e) => {
        const days = new FormData(e.currentTarget).get("older_than_days");
        const msg = days
          ? `Supprimer les logs de plus de ${days} jour(s) ?`
          : "Supprimer TOUS les logs API ?";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {canFilterByDate && (
        <select name="older_than_days" defaultValue="">
          <option value="">Tous les logs</option>
          <option value="1">Plus de 1 jour</option>
          <option value="7">Plus de 7 jours</option>
          <option value="30">Plus de 30 jours</option>
        </select>
      )}
      <button className="danger" type="submit">Purger</button>
    </form>
  );
}
