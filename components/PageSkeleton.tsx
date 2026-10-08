/** Squelette affiché immédiatement pendant le chargement d'une page (données base / API OneStock). */
export default function PageSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-live="polite">
      <div>
        <div className="sk sk-title" />
        <div className="sk sk-line" style={{ width: 320 }} />
      </div>
      <div className="card flush">
        <div className="toolbar">
          <div className="sk sk-input" />
          <div className="sk sk-button" />
        </div>
        <div className="sk-table">
          {Array.from({ length: rows }, (_, r) => (
            <div className="sk-row" key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <div key={c} className="sk sk-cell" style={{ width: `${c === 0 ? 30 : 60 / columns}%` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
