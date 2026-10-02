"use client";

import { purgeLogs } from "../actions";

const DAYS = [1, 7, 30];

type Labels = {
  purge: string;
  allLogs: string;
  olderThan: string[];
  confirmOlder: string[];
  confirmAll: string;
};

export default function PurgeForm({
  canFilterByDate,
  context,
  labels,
}: {
  canFilterByDate: boolean;
  context: string;
  labels: Labels;
}) {
  return (
    <form
      action={purgeLogs}
      className="row"
      onSubmit={(e) => {
        const days = Number(new FormData(e.currentTarget).get("older_than_days"));
        const i = DAYS.indexOf(days);
        if (!confirm(i >= 0 ? labels.confirmOlder[i] : labels.confirmAll)) e.preventDefault();
      }}
    >
      <input type="hidden" name="context" value={context} />
      {canFilterByDate && (
        <select name="older_than_days" defaultValue="">
          <option value="">{labels.allLogs}</option>
          {DAYS.map((d, i) => (
            <option key={d} value={d}>{labels.olderThan[i]}</option>
          ))}
        </select>
      )}
      <button className="danger" type="submit">{labels.purge}</button>
    </form>
  );
}
