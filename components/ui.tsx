import Link from "next/link";
import ModalBackdrop from "@/components/ModalBackdrop";

const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 6.5l2.6 1.5M17.2 16l2.6 1.5M4.2 17.5l2.6-1.5M17.2 8l2.6-1.5" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  remove: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <><circle cx="12" cy="12" r="8.5" /><path d="m8 12 3 3 5-6" /></>,
  error: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16v.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.5V8" /></>,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  store: <><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12v8h13v-8" /></>,
  cube: <><path d="M12 3l7.5 4.3v9.4L12 21l-7.5-4.3V7.3L12 3z" /><path d="M12 12v9M4.5 7.3 12 12l7.5-4.7" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

const ALERT_ICON = { success: "check", danger: "error", info: "info", neutral: "info" } as const;

export function Alert({ type, children }: { type: keyof typeof ALERT_ICON; children: React.ReactNode }) {
  return (
    <div className={`alert alert-${type}`} role={type === "danger" ? "alert" : "status"}>
      <Icon name={ALERT_ICON[type]} size={18} />
      <div className="alert-body">{children}</div>
    </div>
  );
}

/** Modale pilotée par l'URL : `closeHref` ramène à la page sans le paramètre qui l'ouvre. */
export function Modal({
  title,
  closeHref,
  closeLabel,
  wide,
  children,
}: {
  title: string;
  closeHref: string;
  closeLabel: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ModalBackdrop closeHref={closeHref}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <Link href={closeHref} className="btn btn-icon" aria-label={closeLabel} title={closeLabel} scroll={false}>
            <Icon name="close" />
          </Link>
        </div>
        {children}
      </div>
    </ModalBackdrop>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
