/* ══════════════════════════════════════════════════════════
   BlockVault — Shared TypeScript Types
   ══════════════════════════════════════════════════════════ */

/* ── Auth ───────────────────────────────────────────────── */

export interface User {
  id:         number;
  name:       string;
  email:      string;
  is_active:  boolean;
  is_admin:   boolean;
  email_verified: boolean;
  email_verified_at?: string | null;
  last_login_at?: string | null;
  created_at: string;   // ISO 8601
}

export interface TokenResponse {
  access_token: string;
  token_type:   string; // "bearer"
  user:         User;
}

export interface UserUpdatePayload {
  name:  string;
  email: string;
}

export interface VerificationStartResponse {
  message: string;
  email: string;
  expires_in_minutes: number;
  verification_token: string;
  dev_otp?: string | null;
}

export interface UsersExportMeta {
  download_path: string;
  filename: string;
  updated_at: string;
}

/* ── Documents ──────────────────────────────────────────── */

export type DocumentStatus = "pending" | "verified" | "rejected";

export interface Document {
  id:            number;
  filename:      string;      // internal stored name
  original_name: string;      // user-facing file name
  document_hash: string;      // SHA-256 hex string
  file_size:     number | null;
  mime_type:     string | null;
  status:        DocumentStatus;
  block_index:   number | null;
  tx_id:         string | null;
  uploaded_at:   string;      // ISO 8601
  verified_at:   string | null;
  reviewed_at:   string | null;
  reviewed_by:   number | null;
  archived_at:   string | null;
  archived_by:   number | null;
  is_archived:   boolean;
  notes:         string | null;
}

export interface AuditEvent {
  timestamp:     string;
  event_type:    string;
  title:         string;
  description:   string;
  document_id?:  number | null;
  document_hash?: string | null;
  document_name?: string | null;
  block_index?:  number | null;
  tx_id?:        string | null;
}

export interface DocumentDetail {
  document:    Document;
  audit_trail: AuditEvent[];
  share_path:  string;
}

export interface DocumentSummary {
  total_documents:       number;
  verified_documents:    number;
  pending_documents:     number;
  rejected_documents:    number;
  archived_documents:    number;
  total_storage_bytes:   number;
  verification_rate:     number;
  blockchain_blocks:     number;
  chain_valid:           boolean;
  latest_upload_at?:     string | null;
  latest_verification_at?: string | null;
  recent_activity:       AuditEvent[];
}

export interface DocumentReviewPayload {
  action: "approve" | "reject";
  notes?: string;
}

export interface VerifyResult {
  verified:        boolean;
  document_hash:   string;
  block_index?:    number;
  block_timestamp?: number;   // Unix epoch seconds
  uploader_email?: string;
  original_name?:  string;
  uploaded_at?:    string;
  message:         string;
}

/* ── Blockchain ─────────────────────────────────────────── */

export interface BlockTransaction {
  tx_id:          string;
  document_hash:  string;
  uploader_id:    number;
  uploader_email: string;
  filename:       string;
  timestamp:      number;    // Unix epoch seconds
}

export interface Block {
  index:         number;
  timestamp:     number;     // Unix epoch seconds
  transactions:  BlockTransaction[];
  proof:         number;
  previous_hash: string;
}

export interface ChainStatus {
  length:               number;
  is_valid:             boolean;
  pending_transactions: number;
  blocks:               Block[];
}
