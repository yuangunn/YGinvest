"use client";

import { useState } from "react";

type Props = {
  type: string;
  label: string;
  defaultChecked: boolean;
};

export function NotificationTypeToggle({ type, label, defaultChecked }: Props) {
  const [checked, setChecked] = useState(defaultChecked);
  const [pending, setPending] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setChecked(next);
    setPending(true);
    try {
      await fetch("/api/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [type]: next }),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="flex items-center justify-between gap-2 py-2 border-b">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={pending}
        className="h-4 w-4"
      />
    </label>
  );
}
