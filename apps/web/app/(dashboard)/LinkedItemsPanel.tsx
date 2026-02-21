"use client";

import type { CrossLink } from "../../lib/types";

const ENTITY_ICONS: Record<string, string> = {
  FINDING: "🔍", INCIDENT: "🚨", NC: "❌", RISK: "⚠️", CAPA: "✅",
  AUDIT: "📋", ASSET: "🖥️", CERTIFICATION: "🛡️", CHANGE: "🔄",
};

const ENTITY_LABELS: Record<string, string> = {
  FINDING: "Audit Finding", INCIDENT: "Incident", NC: "Non-Conformity",
  RISK: "Risk", CAPA: "CAPA", AUDIT: "Audit", ASSET: "Asset",
  CERTIFICATION: "Certification", CHANGE: "Change Request",
};

const ENTITY_PATHS: Record<string, string> = {
  INCIDENT: "/incidents", NC: "/nonconformities",
  RISK: "/risks", CAPA: "/capas", AUDIT: "/audits", ASSET: "/assets",
  CERTIFICATION: "/certifications", CHANGE: "/changes",
};

export default function LinkedItemsPanel({
  entityType,
  entityId,
  links,
}: {
  entityType: string;
  entityId: string;
  links: CrossLink[];
}) {
  if (!links || links.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 24px" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔗</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>No linked items</div>
        <div style={{ fontSize: 13, color: "#6b7280", maxWidth: 340, margin: "0 auto" }}>
          Cross-register links are created automatically when you use "Send to Risk", "Send to NC", or "Send to CAPA" actions.
        </div>
      </div>
    );
  }

  // Separate links into "created from this" (this entity is source) and "created this" (this entity is target)
  const outgoing = links.filter((l) => l.source_type === entityType && l.source_id === entityId);
  const incoming = links.filter((l) => l.target_type === entityType && l.target_id === entityId);

  return (
    <div style={{ padding: "4px 0" }}>
      {/* Outgoing: items created FROM this entity */}
      {outgoing.length > 0 && (
        <div style={{ marginBottom: incoming.length > 0 ? 24 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 10 }}>
            Created from this {ENTITY_LABELS[entityType]?.toLowerCase() || "item"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {outgoing.map((link) => (
              <LinkCard key={link.id} link={link} side="target" />
            ))}
          </div>
        </div>
      )}

      {/* Incoming: this entity was created FROM another */}
      {incoming.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: 10 }}>
            Originated from
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {incoming.map((link) => (
              <LinkCard key={link.id} link={link} side="source" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkCard({ link, side }: { link: CrossLink; side: "source" | "target" }) {
  const type = side === "target" ? link.target_type : link.source_type;
  const id = side === "target" ? link.target_id : link.source_id;
  const title = side === "target" ? link.target_title : link.source_title;
  const icon = ENTITY_ICONS[type] || "📌";
  const label = ENTITY_LABELS[type] || type;
  const path = ENTITY_PATHS[type];
  const href = path ? `${path}/${id}` : null;

  const directionLabel = side === "target" ? "→" : "←";
  const directionColor = side === "target" ? "#3b82f6" : "#8b5cf6";

  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href, style: { textDecoration: "none" } } : {};

  return (
    <Wrapper {...wrapperProps as any}>
      <div style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff",
        transition: "border-color 0.15s, box-shadow 0.15s",
        cursor: href ? "pointer" : "default",
      }}
        onMouseEnter={(e) => {
          if (!href) return;
          e.currentTarget.style.borderColor = directionColor;
          e.currentTarget.style.boxShadow = `0 0 0 1px ${directionColor}20`;
        }}
        onMouseLeave={(e) => {
          if (!href) return;
          e.currentTarget.style.borderColor = "#e5e7eb";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {/* Icon + direction badge */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ fontSize: 24 }}>{icon}</div>
            <div style={{
              position: "absolute", bottom: -4, right: -6,
              fontSize: 10, fontWeight: 700, color: "#fff",
              background: directionColor, borderRadius: 4,
              padding: "0 3px", lineHeight: "16px",
            }}>
              {directionLabel}
            </div>
          </div>

          {/* Content */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: directionColor, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {label}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 550, color: "#111", marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {title || `${label} (${id.slice(0, 8)}…)`}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              {link.link_type === "GENERATED" ? "Auto-generated" : "Manual link"} · {new Date(link.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Open arrow */}
        {href && (
          <div style={{ fontSize: 13, color: "#9ca3af", flexShrink: 0, marginLeft: 8 }}>
            Open →
          </div>
        )}
      </div>
    </Wrapper>
  );
}
