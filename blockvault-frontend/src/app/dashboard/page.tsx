"use client";

import { useEffect, useState } from "react";
import {
  FileCheck,
  Layers,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import AppLayout from "@/components/layout/AppLayout";
import { documentsApi, blockchainApi } from "@/lib/api";
import type { ChainStatus, Document, DocumentSummary } from "@/types";

/* ── Stat card config ──────────────────────────────────────── */
interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

/* ── Page component ────────────────────────────────────────── */
export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [summaryResponse, chainResponse] = await Promise.all([
          documentsApi.summary(),
          blockchainApi.chain(),
        ]);
        setSummary(summaryResponse.data);
        setChainStatus(chainResponse.data);
      } catch (error) {
        console.error("Failed to load document summary:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSummary();
  }, []);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await documentsApi.list(0, 5);
        setDocuments(response.data);
      } catch (error) {
        console.error("Failed to load documents:", error);
      }
    };

    void loadDocuments();
  }, []);

  const recentDocuments = documents;

  const statCards: StatCard[] = [
    {
      label: "Protected Documents",
      value: summary?.total_documents ?? recentDocuments.length,
      icon: FileCheck,
      color: "var(--color-brand-bright)",
      bgColor: "var(--color-brand-dim)",
    },
    {
      label:   "Chain Blocks",
      value:   chainStatus?.length ?? "—",
      icon:    Layers,
      color:   "var(--color-success)",
      bgColor: "var(--color-success-dim)",
    },
    {
      label:   "Chain Integrity",
      value:   chainStatus ? (chainStatus.is_valid ? "Valid" : "Tampered") : "—",
      icon:    ShieldCheck,
      color:   chainStatus?.is_valid ? "var(--color-success)" : "var(--color-danger)",
      bgColor: chainStatus?.is_valid ? "var(--color-success-dim)" : "var(--color-danger-dim)",
    },
    {
      label:   "Pending Transactions",
      value:   chainStatus?.pending_transactions ?? 0,
      icon:    Clock,
      color:   "var(--color-warning)",
      bgColor: "var(--color-warning-dim)",
    },
  ];

  return (
    <AppLayout>
      <div style={{ padding: "36px 40px", maxWidth: 1080 }}>

        {/* ── Page header ──────────────────────────────── */}
        <div className="fade-up" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, marginBottom: 5 }}>Operations Dashboard</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Monitor blockchain-backed documents, audit events, and verification health in one place.
          </p>
        </div>

        {/* ── Stat cards ───────────────────────────────── */}
        <div
          className="fade-up delay-1"
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap:                 16,
            marginBottom:        36,
          }}
        >
          {statCards.map(({ label, value, icon: Icon, color, bgColor }) => (
            <div
              key={label}
              className="bv-card"
              style={{ padding: "20px 22px" }}
            >
              <div
                style={{
                  width:        40,
                  height:       40,
                  borderRadius: "var(--radius-md)",
                  background:   bgColor,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  marginBottom: 16,
                  border:       `1px solid ${color}33`,
                }}
              >
                <Icon size={18} color={color} />
              </div>
              <p className="bv-stat-value" style={{ color }}>
                {isLoading ? "..." : value}
              </p>
              <p className="bv-stat-label">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Recent documents table ───────────────────── */}
        <div className="fade-up delay-2">
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              marginBottom:   14,
            }}
          >
            <h2 style={{ fontSize: 16 }}>Recent Documents</h2>
            <a
              href="/upload"
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        4,
                fontSize:   13,
                color:      "var(--color-brand-bright)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
              }}
            >
              Upload new <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="bv-card" style={{ overflow: "hidden" }}>
            {isLoading ? (
              <div className="bv-empty">
                <p className="bv-empty__desc">Loading documents…</p>
              </div>
            ) : recentDocuments.length === 0 ? (
              <div className="bv-empty">
                <FileCheck size={36} className="bv-empty__icon" />
                <p className="bv-empty__title">No documents yet</p>
                <p className="bv-empty__desc">Upload your first document to get started</p>
                <a
                  href="/upload"
                  className="bv-btn bv-btn--primary"
                  style={{ marginTop: 8, textDecoration: "none" }}
                >
                  Upload Document
                </a>
              </div>
            ) : (
              <table className="bv-table">
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>SHA-256 Hash</th>
                    <th>Block</th>
                    <th>Status</th>
                    <th>Uploaded At</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocuments.map((doc) => (
                    <tr key={doc.id}>
                      <td style={{ fontWeight: 500 }}>{doc.original_name}</td>
                      <td>
                        <span
                          className="font-mono"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          {doc.document_hash.slice(0, 14)}…
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "var(--color-brand-bright)", fontWeight: 600 }}>
                          #{doc.block_index ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`bv-badge bv-badge--${doc.status}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                        {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Latest blocks preview ────────────────────── */}
        {chainStatus && chainStatus.blocks.length > 1 && (
          <div className="fade-up delay-3" style={{ marginTop: 32 }}>
            <div
              style={{
                display:        "flex",
                alignItems:     "center",
                justifyContent: "space-between",
                marginBottom:   14,
              }}
            >
              <h2 style={{ fontSize: 16 }}>Latest Blocks</h2>
              <a
                href="/blockchain"
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        4,
                  fontSize:   13,
                  color:      "var(--color-brand-bright)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                }}
              >
                View chain <ArrowUpRight size={14} />
              </a>
            </div>

            <div
              style={{
                display:    "flex",
                gap:        12,
                overflowX:  "auto",
                paddingBottom: 4,
              }}
            >
              {[...chainStatus.blocks].reverse().slice(0, 5).map((block) => (
                <div
                  key={block.index}
                  className="bv-card"
                  style={{
                    padding:   "16px 18px",
                    minWidth:  168,
                    flexShrink: 0,
                    borderColor:
                      block.index === chainStatus.length
                        ? "rgba(124,111,247,0.4)"
                        : undefined,
                  }}
                >
                  <div
                    style={{
                      display:    "flex",
                      alignItems: "center",
                      gap:        6,
                      marginBottom: 10,
                    }}
                  >
                    <Hash size={13} color="var(--color-brand-bright)" />
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize:   14,
                        color:      "var(--color-brand-bright)",
                      }}
                    >
                      Block {block.index}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 5 }}>
                    {block.transactions.length} transaction
                    {block.transactions.length !== 1 ? "s" : ""}
                  </p>
                  <p
                    className="font-mono"
                    style={{ fontSize: 10, color: "var(--color-text-disabled)" }}
                  >
                    {block.previous_hash.slice(0, 14)}…
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
