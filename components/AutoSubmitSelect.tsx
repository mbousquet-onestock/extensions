"use client";

/** Liste déroulante qui soumet son formulaire (GET) dès qu'on change de valeur. */
export default function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="select" onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
