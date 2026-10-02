"use client";

export default function ConfirmButton({
  message,
  className = "btn btn-icon danger",
  title,
  children,
}: {
  message: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={className}
      type="submit"
      title={title}
      aria-label={title}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
