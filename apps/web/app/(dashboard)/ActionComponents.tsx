"use client";

import { useState, useTransition } from "react";

/* ========== Delete Button ========== */
export function DeleteButton({
  onDelete,
  label = "Delete",
}: {
  onDelete: () => Promise<void>;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#ef4444" }}>Are you sure?</span>
        <button
          className="btn btn-danger"
          style={{ padding: "4px 10px", fontSize: 12 }}
          disabled={isPending}
          onClick={() => startTransition(async () => { await onDelete(); setConfirming(false); })}
        >
          {isPending ? "..." : "Yes, delete"}
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      className="btn btn-danger"
      style={{ padding: "4px 10px", fontSize: 12 }}
      onClick={() => setConfirming(true)}
    >
      {label}
    </button>
  );
}

/* ========== Status Dropdown ========== */
export function StatusDropdown({
  currentStatus,
  options,
  onStatusChange,
}: {
  currentStatus: string;
  options: string[];
  onStatusChange: (newStatus: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      className="form-select"
      style={{ padding: "4px 8px", fontSize: 12, minWidth: 130 }}
      value={currentStatus}
      disabled={isPending}
      onChange={(e) => {
        const newStatus = e.target.value;
        if (newStatus !== currentStatus) {
          startTransition(async () => { await onStatusChange(newStatus); });
        }
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

/* ========== Send to Risk Register Button ========== */
export function SendToRiskButton({
  onSend,
}: {
  onSend: () => Promise<void>;
}) {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
        ✓ Sent to Risk Register
      </span>
    );
  }

  return (
    <button
      className="btn btn-warning"
      style={{ padding: "4px 10px", fontSize: 12 }}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await onSend();
          setSent(true);
        })
      }
    >
      {isPending ? "Sending..." : "⚠ Send to Risk Register"}
    </button>
  );
}

/* ========== Inline Edit Field ========== */
export function InlineEdit({
  label,
  name,
  value,
  type = "text",
  onSave,
  options,
}: {
  label: string;
  name: string;
  value: string;
  type?: "text" | "date" | "textarea" | "select" | "number";
  onSave: (name: string, value: string) => Promise<void>;
  options?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#111" }}>
            {value || <span style={{ color: "#ccc" }}>—</span>}
          </span>
          <button
            onClick={() => { setEditValue(value); setEditing(true); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280" }}
          >
            ✏️
          </button>
        </div>
      </div>
    );
  }

  const save = () => {
    startTransition(async () => {
      await onSave(name, editValue);
      setEditing(false);
    });
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {type === "textarea" ? (
          <textarea
            className="form-textarea"
            style={{ fontSize: 13 }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          />
        ) : type === "select" ? (
          <select
            className="form-select"
            style={{ fontSize: 13, padding: "4px 8px" }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          >
            {options?.map((o) => (
              <option key={o} value={o}>{o.replace(/_/g, " ")}</option>
            ))}
          </select>
        ) : (
          <input
            className="form-input"
            style={{ fontSize: 13, padding: "4px 8px" }}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          />
        )}
        <button
          className="btn btn-primary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          disabled={isPending}
          onClick={save}
        >
          {isPending ? "..." : "Save"}
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ========== Tabs Component ========== */
export function Tabs({
  tabs,
  children,
}: {
  tabs: string[];
  children: React.ReactNode[];
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "2px solid #f3f4f6",
        marginBottom: 20,
      }}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActive(i)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: active === i ? 600 : 400,
              color: active === i ? "#111" : "#9ca3af",
              background: "none",
              border: "none",
              borderBottom: active === i ? "2px solid #111" : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div>{children[active]}</div>
    </div>
  );
}
