"use client";

/** Case « erreurs uniquement » qui soumet le formulaire de filtres dès qu'on la coche. */
export default function ErrorsOnlyToggle({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="check">
      <input
        type="checkbox"
        name="errors"
        value="1"
        defaultChecked={checked}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      {label}
    </label>
  );
}
