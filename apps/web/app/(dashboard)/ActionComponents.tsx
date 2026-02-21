"use client";

import { useState, useTransition } from "react";
import { useToast } from "./Toast";

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
  const toast = useToast();

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#ef4444" }}>Are you sure?</span>
        <button
          className="btn btn-danger"
          style={{ padding: "4px 10px", fontSize: 12 }}
          disabled={isPending}
          onClick={() => startTransition(async () => {
            try {
              await onDelete();
              toast.success("Deleted successfully");
            } catch (err: any) {
              toast.error(err.message || "Delete failed");
            }
            setConfirming(false);
          })}
        >
          {isPending ? <><span className="spinner" /> Deleting…</> : "Yes, delete"}
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
  const toast = useToast();

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <select
        className="form-select"
        style={{ padding: "4px 8px", fontSize: 12, minWidth: 130 }}
        value={currentStatus}
        disabled={isPending}
        onChange={(e) => {
          const newStatus = e.target.value;
          if (newStatus !== currentStatus) {
            startTransition(async () => {
              try {
                await onStatusChange(newStatus);
                toast.success(`Status updated to ${newStatus.replace(/_/g, " ")}`);
              } catch (err: any) {
                toast.error(err.message || "Status update failed");
              }
            });
          }
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {isPending && <span className="spinner" />}
    </span>
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
  const toast = useToast();

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
      style={{ padding: "4px 10px", fontSize: 12, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await onSend();
            setSent(true);
            toast.success("Sent to Risk Register");
          } catch (err: any) {
            toast.error(err.message || "Failed to send to Risk Register");
          }
        })
      }
    >
      {isPending ? <><span className="spinner" /> Sending…</> : "⚠ Send to Risk Register"}
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
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  type?: "text" | "date" | "textarea" | "select" | "number";
  onSave: (name: string, value: string) => Promise<void>;
  options?: string[];
  required?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const toast = useToast();

  if (!editing) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
          {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: value ? "#111" : "#6b7280" }}>
            {value || "—"}
          </span>
          <button
            onClick={() => { setEditValue(value); setEditing(true); setError(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280", opacity: 0.7, transition: "opacity 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            ✏️
          </button>
        </div>
      </div>
    );
  }

  const save = () => {
    if (required && !editValue.trim()) {
      setError("This field is required");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await onSave(name, editValue);
        setEditing(false);
        toast.success(`${label} updated`);
      } catch (err: any) {
        toast.error(err.message || `Failed to update ${label}`);
      }
    });
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {type === "textarea" ? (
          <textarea
            className="form-textarea"
            style={{ fontSize: 13, borderColor: error ? "#ef4444" : undefined }}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); if (error) setError(""); }}
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
            style={{ fontSize: 13, padding: "4px 8px", borderColor: error ? "#ef4444" : undefined }}
            type={type}
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); if (error) setError(""); }}
          />
        )}
        <button
          className="btn btn-primary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          disabled={isPending}
          onClick={save}
        >
          {isPending ? <><span className="spinner" /> Saving</> : "Save"}
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: "4px 10px", fontSize: 12 }}
          onClick={() => { setEditing(false); setError(""); }}
        >
          Cancel
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{error}</div>}
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
              color: active === i ? "#111" : "#6b7280",
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

/* ========== Empty State ========== */
export function EmptyState({
  icon = "📋",
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div style={{
      textAlign: "center",
      padding: "48px 24px",
      color: "#6b7280",
    }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: "#6b7280", maxWidth: 360, margin: "0 auto" }}>{description}</div>
      )}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="btn btn-primary"
          style={{ marginTop: 16, display: "inline-flex", fontSize: 13, textDecoration: "none" }}
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

/* ========== Confirm Modal (inline replacement for window.confirm) ========== */
export function ConfirmAction({
  trigger,
  message,
  onConfirm,
  confirmLabel = "Confirm",
  confirmStyle = "danger",
}: {
  trigger: React.ReactNode;
  message: string;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
  confirmStyle?: "danger" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ cursor: "pointer" }}>{trigger}</span>
      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: "24px 28px", maxWidth: 400, width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 8 }}>Confirm Action</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{message}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                style={{ padding: "6px 14px", fontSize: 12 }}
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                className={`btn btn-${confirmStyle}`}
                style={{ padding: "6px 14px", fontSize: 12 }}
                disabled={isPending}
                onClick={() => startTransition(async () => {
                  try {
                    await onConfirm();
                    setOpen(false);
                  } catch (err: any) {
                    toast.error(err.message || "Action failed");
                  }
                })}
              >
                {isPending ? <><span className="spinner" /> Working…</> : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
