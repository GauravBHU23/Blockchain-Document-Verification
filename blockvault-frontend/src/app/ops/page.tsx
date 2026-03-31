"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  Layers,
  Link2,
  Loader2,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { authApi, documentsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import type { Document, DocumentDetail, DocumentSummary, User, UsersExportMeta } from "@/types";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Verified", value: "verified" },
  { label: "Pending", value: "pending" },
  { label: "Rejected", value: "rejected" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function OpsPage() {
  const { user, hydrate } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DocumentDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isDownloadingUsers, setIsDownloadingUsers] = useState(false);
  const [actingDocumentId, setActingDocumentId] = useState<number | null>(null);
  const [actingUserId, setActingUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersExportMeta, setUsersExportMeta] = useState<UsersExportMeta | null>(null);
  const isAdmin = Boolean(user?.is_admin);

  const loadSummary = async () => {
    try {
      const response = await documentsApi.summary();
      setSummary(response.data);
    } catch (error) {
      console.error("Failed to load operations summary:", error);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const loadDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      const response = await documentsApi.list(0, 12, searchQuery || undefined, statusFilter || undefined, includeArchived);
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    try {
      setIsLoadingUsers(true);
      const [usersResponse, exportResponse] = await Promise.all([
        authApi.listUsers(),
        authApi.usersExportMeta(),
      ]);
      setUsers(usersResponse.data);
      setUsersExportMeta(exportResponse.data);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [searchQuery, statusFilter, includeArchived]);

  useEffect(() => {
    if (isAdmin) {
      void loadUsers();
    }
  }, [isAdmin]);

  const handleSelectDocument = async (documentId: number) => {
    try {
      setIsLoadingDetail(true);
      const response = await documentsApi.detail(documentId);
      setSelectedDetail(response.data);
    } catch (error) {
      console.error("Failed to load document detail:", error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const copyProofLink = async () => {
    if (!selectedDetail || typeof window === "undefined") return;
    await navigator.clipboard.writeText(`${window.location.origin}${selectedDetail.share_path}`);
  };

  const handleArchiveToggle = async (documentId: number, archive: boolean) => {
    const targetDocument = documents.find((doc) => doc.id === documentId) ?? selectedDetail?.document;
    const documentLabel = targetDocument?.original_name ?? "this document";

    if (!window.confirm(`${archive ? "Archive" : "Restore"} ${documentLabel}?`)) {
      return;
    }

    try {
      setActingDocumentId(documentId);
      if (archive) {
        await documentsApi.archive(documentId);
        toast.success("Document archived successfully");
      } else {
        await documentsApi.restore(documentId);
        toast.success("Document restored successfully");
      }

      if (selectedDetail?.document.id === documentId) {
        setSelectedDetail(null);
      }

      await Promise.all([
        loadDocuments(),
        loadSummary(),
      ]);
    } catch (error) {
      console.error("Failed to update archive state:", error);
      toast.error(`Could not ${archive ? "archive" : "restore"} the document`);
    } finally {
      setActingDocumentId(null);
    }
  };

  const handleReviewDocument = async (documentId: number, action: "approve" | "reject") => {
    const notes = window.prompt(
      action === "approve"
        ? "Optional approval note:"
        : "Reason for rejection:",
      ""
    );
    if (notes === null) return;

    try {
      setActingDocumentId(documentId);
      await documentsApi.review(documentId, action, notes || undefined);
      toast.success(action === "approve" ? "Document approved" : "Document rejected");
      await Promise.all([loadDocuments(), loadSummary()]);
      if (selectedDetail?.document.id === documentId) {
        await handleSelectDocument(documentId);
      }
    } catch (error) {
      console.error("Failed to review document:", error);
      toast.error(`Could not ${action} the document`);
    } finally {
      setActingDocumentId(null);
    }
  };

  const handleUserStatusToggle = async (targetUser: User) => {
    const nextState = !targetUser.is_active;
    if (!window.confirm(`${nextState ? "Enable" : "Disable"} ${targetUser.name}?`)) {
      return;
    }

    try {
      setActingUserId(targetUser.id);
      await authApi.updateUserStatus(targetUser.id, nextState);
      toast.success(`User ${nextState ? "enabled" : "disabled"} successfully`);
      await loadUsers();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object" &&
        (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Could not update user status";
      console.error("Failed to update user status:", error);
      toast.error(typeof message === "string" ? message : "Could not update user status");
    } finally {
      setActingUserId(null);
    }
  };

  const handleDownloadUsersExport = async () => {
    try {
      setIsDownloadingUsers(true);
      const response = await authApi.downloadUsersExport();
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = usersExportMeta?.filename ?? "users_export_live.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download users export:", error);
      toast.error("Could not download users CSV");
    } finally {
      setIsDownloadingUsers(false);
    }
  };

  return (
    <AppLayout>
      {/* Responsive grid styles injected via a style tag */}
      <style>{`
        .ops-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
          margin-bottom: 24px;
        }
        @media (min-width: 768px) {
          .ops-main-grid {
            grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.9fr);
          }
        }

        .ops-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        @media (min-width: 640px) {
          .ops-stats-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .ops-search-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }
        @media (min-width: 480px) {
          .ops-search-grid {
            grid-template-columns: minmax(0, 1fr) 180px;
          }
        }

        .ops-audit-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (min-width: 640px) {
          .ops-audit-grid {
            grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
          }
        }

        .ops-activity-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .ops-activity-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .ops-activity-scroll::-webkit-scrollbar-thumb {
          background: var(--color-border-subtle);
          border-radius: 4px;
        }
        .ops-activity-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-disabled);
        }
      `}</style>

      <div style={{ padding: "36px 40px", maxWidth: 1240 }}>
        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Operations Center</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            Company-style visibility into protected files, audit activity, and public proof sharing.
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-disabled)", marginTop: 8 }}>
            Access level: {isAdmin ? "Administrator review console" : "User workspace"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="ops-stats-grid">
          {[
            {
              label: "Protected Documents",
              value: summary?.total_documents ?? "...",
              icon: FileText,
              color: "var(--color-brand-bright)",
              bg: "var(--color-brand-dim)",
            },
            {
              label: "Verification Rate",
              value: summary ? `${summary.verification_rate}%` : "...",
              icon: ShieldCheck,
              color: "var(--color-success)",
              bg: "var(--color-success-dim)",
            },
            {
              label: "Storage Secured",
              value: summary ? formatBytes(summary.total_storage_bytes) : "...",
              icon: HardDrive,
              color: "var(--color-warning)",
              bg: "var(--color-warning-dim)",
            },
            {
              label: "Blockchain Blocks",
              value: summary?.blockchain_blocks ?? "...",
              icon: Layers,
              color: "var(--color-text-primary)",
              bg: "var(--color-bg-overlay)",
            },
            {
              label: "Archived Records",
              value: summary?.archived_documents ?? "...",
              icon: RotateCcw,
              color: "var(--color-text-muted)",
              bg: "var(--color-bg-surface)",
            },
          ].map((card) => (
            <div key={card.label} className="bv-card" style={{ padding: 20 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "var(--radius-md)",
                  background: card.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <card.icon size={18} color={card.color} />
              </div>
              <p className="bv-stat-value" style={{ color: card.color }}>
                {isLoadingSummary ? "..." : card.value}
              </p>
              <p className="bv-stat-label">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Main two-column grid — responsive */}
        <div className="ops-main-grid">

          {/* Document Inventory */}
          <div className="bv-card" style={{ padding: 22 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: isInventoryOpen ? 18 : 0,
              }}
            >
              <button
                type="button"
                onClick={() => setIsInventoryOpen((value) => !value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <h2 style={{ fontSize: 16, marginBottom: 4 }}>Document Inventory</h2>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    Searchable records with drill-down audit details.
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  color="var(--color-text-muted)"
                  style={{
                    transform: isInventoryOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform var(--transition-fast)",
                  }}
                />
              </button>
              <Link
                href="/upload"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 13,
                  color: "var(--color-brand-bright)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                }}
              >
                Upload new <ExternalLink size={14} />
              </Link>
            </div>

            {isInventoryOpen && (
              <>
                <div className="ops-search-grid">
                  <div className="bv-input-wrapper">
                    <Search size={15} className="bv-input-icon bv-input-icon--left" />
                    <input
                      className="bv-input bv-input--icon-left"
                      placeholder="Search by name, hash, or tx id"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </div>

                  <select
                    className="bv-input"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 18,
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(event) => setIncludeArchived(event.target.checked)}
                  />
                  Include archived records
                </label>

                {isLoadingDocs ? (
                  <div className="bv-empty">
                    <p className="bv-empty__desc">Loading documents...</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="bv-empty">
                    <p className="bv-empty__title">No matching documents</p>
                    <p className="bv-empty__desc">Try a different filter or register a new document.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="bv-table" style={{ minWidth: 480 }}>
                      <thead>
                      <tr>
                        <th>Document</th>
                        <th>Hash</th>
                        <th>Block</th>
                        <th>Status</th>
                        <th>Uploaded</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                          <tr
                            key={doc.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => void handleSelectDocument(doc.id)}
                          >
                            <td style={{ fontWeight: 500 }}>{doc.original_name}</td>
                            <td>
                              <span className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                                {doc.document_hash.slice(0, 14)}...
                              </span>
                            </td>
                            <td>
                              <span style={{ color: "var(--color-brand-bright)", fontWeight: 600 }}>
                                #{doc.block_index ?? "-"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <span className={`bv-badge bv-badge--${doc.status}`}>{doc.status}</span>
                                {doc.is_archived && <span className="bv-badge">archived</span>}
                              </div>
                            </td>
                          <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                            {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {isAdmin && !doc.is_archived && doc.status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    className="bv-btn bv-btn--ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleReviewDocument(doc.id, "approve");
                                    }}
                                    disabled={actingDocumentId === doc.id}
                                    style={{ padding: "8px 12px", color: "var(--color-success)" }}
                                  >
                                    {actingDocumentId === doc.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="bv-btn bv-btn--ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleReviewDocument(doc.id, "reject");
                                    }}
                                    disabled={actingDocumentId === doc.id}
                                    style={{ padding: "8px 12px", color: "var(--color-danger)" }}
                                  >
                                    {actingDocumentId === doc.id ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                                    Reject
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                className="bv-btn bv-btn--ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleArchiveToggle(doc.id, !doc.is_archived);
                                }}
                                disabled={actingDocumentId === doc.id}
                                style={{
                                  padding: "8px 12px",
                                  color: doc.is_archived ? "var(--color-brand-bright)" : "var(--color-warning)",
                                }}
                              >
                                {actingDocumentId === doc.id ? (
                                  <Loader2 size={14} className="spin" />
                                ) : doc.is_archived ? (
                                  <RotateCcw size={14} />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                                {doc.is_archived ? "Restore" : "Archive"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Activity — scrollable */}
          <div className="bv-card" style={{ padding: 22 }}>
            <button
              type="button"
              onClick={() => setIsActivityOpen((value) => !value)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                background: "transparent",
                border: "none",
                padding: 0,
                marginBottom: isActivityOpen ? 16 : 0,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} color="var(--color-brand-bright)" />
                <h2 style={{ fontSize: 16 }}>Recent Activity</h2>
              </div>
              <ChevronDown
                size={18}
                color="var(--color-text-muted)"
                style={{
                  transform: isActivityOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform var(--transition-fast)",
                }}
              />
            </button>

            {isActivityOpen && (
              /* Scrollable container — max height matches roughly the inventory card */
              <div
                className="ops-activity-scroll"
                style={{
                  maxHeight: 420,
                  overflowY: "auto",
                  paddingRight: 6,
                }}
              >
                {isLoadingSummary ? (
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading activity...</p>
                ) : summary?.recent_activity.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {summary.recent_activity.map((event, index) => (
                      <div
                        key={`${event.event_type}-${event.timestamp}-${index}`}
                        style={{
                          paddingBottom: 14,
                          borderBottom:
                            index === summary.recent_activity.length - 1
                              ? "none"
                              : "1px solid var(--color-border-subtle)",
                        }}
                      >
                        <p
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 13,
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                        >
                          {event.title}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 6 }}>
                          {event.description}
                        </p>
                        <p className="font-mono" style={{ fontSize: 11, color: "var(--color-text-disabled)" }}>
                          {format(new Date(event.timestamp), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No audit activity yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Audit Detail */}
        <div className="bv-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <FileText size={16} color="var(--color-brand-bright)" />
            <h2 style={{ fontSize: 16 }}>Audit Detail</h2>
          </div>

          {isLoadingDetail ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-muted)" }}>
              <Loader2 size={15} className="spin" />
              Loading audit trail...
            </div>
          ) : selectedDetail ? (
            <div className="ops-audit-grid">
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, marginBottom: 6 }}>
                  {selectedDetail.document.original_name}
                </p>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className={`bv-badge bv-badge--${selectedDetail.document.status}`}>
                      {selectedDetail.document.status}
                    </span>
                    {selectedDetail.document.is_archived && <span className="bv-badge">archived</span>}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label className="bv-label" style={{ marginBottom: 6 }}>Document Hash</label>
                  <div className="bv-hash">{selectedDetail.document.document_hash}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedDetail.audit_trail.map((event, index) => (
                    <div
                      key={`${event.event_type}-${event.timestamp}-${index}`}
                      style={{
                        padding: 12,
                        borderRadius: "var(--radius-md)",
                        background: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                        {event.title}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 5 }}>
                        {event.description}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--color-text-disabled)" }}>
                        {format(new Date(event.timestamp), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bv-card" style={{ padding: 18, background: "var(--color-bg-surface)" }}>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: 8 }}>
                  Public Proof Controls
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
                  Share proof links externally and open the public verification page directly from operations.
                </p>
                <div className="bv-hash" style={{ marginBottom: 14 }}>
                  {selectedDetail.share_path}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {isAdmin && !selectedDetail.document.is_archived && selectedDetail.document.status === "pending" && (
                    <>
                      <button
                        className="bv-btn bv-btn--ghost"
                        onClick={() => void handleReviewDocument(selectedDetail.document.id, "approve")}
                        disabled={actingDocumentId === selectedDetail.document.id}
                        style={{ color: "var(--color-success)" }}
                      >
                        {actingDocumentId === selectedDetail.document.id ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        Approve Document
                      </button>
                      <button
                        className="bv-btn bv-btn--ghost"
                        onClick={() => void handleReviewDocument(selectedDetail.document.id, "reject")}
                        disabled={actingDocumentId === selectedDetail.document.id}
                        style={{ color: "var(--color-danger)" }}
                      >
                        {actingDocumentId === selectedDetail.document.id ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                        Reject Document
                      </button>
                    </>
                  )}
                  <Link
                    href={selectedDetail.share_path}
                    className="bv-btn bv-btn--primary"
                    style={{ textDecoration: "none" }}
                  >
                    <ExternalLink size={14} />
                    Open Public Proof
                  </Link>
                  <button className="bv-btn bv-btn--ghost" onClick={() => void copyProofLink()}>
                    <Link2 size={14} />
                    Copy Proof Link
                  </button>
                  <button
                    className="bv-btn bv-btn--ghost"
                    onClick={() => void handleArchiveToggle(selectedDetail.document.id, !selectedDetail.document.is_archived)}
                    disabled={actingDocumentId === selectedDetail.document.id}
                    style={{ color: selectedDetail.document.is_archived ? "var(--color-brand-bright)" : "var(--color-warning)" }}
                  >
                    {actingDocumentId === selectedDetail.document.id ? (
                      <Loader2 size={14} className="spin" />
                    ) : selectedDetail.document.is_archived ? (
                      <RotateCcw size={14} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    {selectedDetail.document.is_archived ? "Restore Document" : "Archive Document"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Select any document from the inventory table to inspect its audit trail and public proof options.
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="bv-card" style={{ padding: 22, marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={16} color="var(--color-brand-bright)" />
                <div>
                  <h2 style={{ fontSize: 16, marginBottom: 4 }}>Registered Users</h2>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    Admin-only visibility into account status, verification, and recent sign-ins.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="bv-btn bv-btn--ghost"
                onClick={() => void handleDownloadUsersExport()}
                disabled={isDownloadingUsers}
              >
                {isDownloadingUsers ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                Export CSV
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span className="bv-badge">Total {users.length}</span>
              <span className="bv-badge">Verified {users.filter((entry) => entry.email_verified).length}</span>
              <span className="bv-badge">Active {users.filter((entry) => entry.is_active).length}</span>
              <span className="bv-badge">Admins {users.filter((entry) => entry.is_admin).length}</span>
            </div>

            <p style={{ fontSize: 12, color: "var(--color-text-disabled)", marginBottom: 14 }}>
              Export file: {usersExportMeta?.filename ?? "users_export_live.csv"}
              {" • "}
              Last updated: {usersExportMeta?.updated_at ? format(new Date(usersExportMeta.updated_at), "MMM d, yyyy HH:mm") : "syncing"}
            </p>

            {isLoadingUsers ? (
              <div className="bv-empty">
                <p className="bv-empty__desc">Loading registered users...</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="bv-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Verified</th>
                      <th>Last Login</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontWeight: 600 }}>{entry.name}</span>
                            {entry.is_admin && <span className="bv-badge">admin</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{entry.email}</td>
                        <td>
                          <span className={`bv-badge ${entry.is_active ? "" : ""}`}>
                            {entry.is_active ? "active" : "disabled"}
                          </span>
                        </td>
                        <td>
                          <span className="bv-badge">
                            {entry.email_verified ? "verified" : "pending"}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                          {entry.last_login_at ? format(new Date(entry.last_login_at), "MMM d, yyyy HH:mm") : "Never"}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                          {format(new Date(entry.created_at), "MMM d, yyyy")}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="bv-btn bv-btn--ghost"
                            onClick={() => void handleUserStatusToggle(entry)}
                            disabled={actingUserId === entry.id}
                            style={{ color: entry.is_active ? "var(--color-danger)" : "var(--color-success)" }}
                          >
                            {actingUserId === entry.id ? <Loader2 size={14} className="spin" /> : <Power size={14} />}
                            {entry.is_active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
