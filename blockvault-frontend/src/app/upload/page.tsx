"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, CheckCircle2, XCircle,
  Loader2, CloudUpload, Hash, RotateCcw, Copy, ExternalLink, QrCode,
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { documentsApi } from "@/lib/api";
import { buildPublicVerifyPath, buildPublicVerifyUrl, buildQrImageUrl } from "@/lib/verification";
import type { Document } from "@/types";

/* ── Constants ──────────────────────────────────────────────── */
const ACCEPTED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf":   [".pdf"],
  "image/jpeg":        [".jpg", ".jpeg"],
  "image/png":         [".png"],
  "image/webp":        [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

const UPLOAD_STEPS = [
  {
    number: "01",
    title:  "SHA-256 hash generated",
    desc:   "Your file is hashed server-side for integrity fingerprinting",
  },
  {
    number: "02",
    title:  "Transaction broadcast",
    desc:   "The hash is packaged as a pending blockchain transaction",
  },
  {
    number: "03",
    title:  "Proof-of-Work mining",
    desc:   "A valid nonce is computed and a new block is appended",
  },
  {
    number: "04",
    title:  "Immutable record created",
    desc:   "Your document now has a tamper-proof blockchain timestamp",
  },
];

/* ── Page component ─────────────────────────────────────────── */
export default function UploadPage() {
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [isUploading, setIsUploading]     = useState(false);
  const [uploadedDoc, setUploadedDoc]     = useState<Document | null>(null);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);

  /* Dropzone setup */
  const onFileDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setSelectedFile(acceptedFiles[0]);
      setUploadedDoc(null);
      setErrorMessage(null);
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop:   onFileDrop,
    accept:   ACCEPTED_MIME_TYPES,
    maxFiles: 1,
    maxSize:  50 * 1024 * 1024,
  });

  /* Upload handler */
  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const response = await documentsApi.upload(selectedFile);
      setUploadedDoc(response.data);
      toast.success("Document registered on the blockchain!");
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? "Upload failed. Please try again."
        : "Upload failed. Please try again.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadedDoc(null);
    setErrorMessage(null);
  };

  const fileSizeLabel = selectedFile
    ? selectedFile.size < 1024 * 1024
      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
      : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
    : null;
  const publicVerifyUrl = uploadedDoc ? buildPublicVerifyUrl(uploadedDoc.document_hash) : "";
  const publicVerifyPath = uploadedDoc ? buildPublicVerifyPath(uploadedDoc.document_hash) : "";
  const qrImageUrl = uploadedDoc ? buildQrImageUrl(publicVerifyUrl) : "";

  const handleCopyVerifyLink = async () => {
    if (!publicVerifyUrl) return;

    try {
      await navigator.clipboard.writeText(publicVerifyUrl);
      toast.success("Public verification link copied");
    } catch {
      toast.error("Could not copy the public link");
    }
  };

  /* ── Success state ─────────────────────────────────── */
  if (uploadedDoc) {
    return (
      <AppLayout>
        <div style={{ padding: "36px 40px", maxWidth: 640 }}>
          <div className="bv-card scale-in" style={{ padding: 36 }}>

            {/* Success icon */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                className="pulse-ring"
                style={{
                  width:    64,
                  height:   64,
                  borderRadius: "50%",
                  background:   "var(--color-success-dim)",
                  border:       "2px solid var(--color-success)",
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "center",
                  margin:       "0 auto 16px",
                }}
              >
                <CheckCircle2 size={28} color="var(--color-success)" />
              </div>
              <h2 style={{ fontSize: 20, color: "var(--color-success)", marginBottom: 6 }}>
                Document Registered!
              </h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                Permanently stored in Block #{uploadedDoc.block_index}
              </p>
            </div>

            <hr className="bv-divider" style={{ marginBottom: 24 }} />

            {/* Document details */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                ["File Name",       uploadedDoc.original_name],
                ["Block Index",     `#${uploadedDoc.block_index}`],
                ["Transaction ID",  uploadedDoc.tx_id ?? "—"],
                ["Status",          uploadedDoc.status],
                ["File Size",       `${((uploadedDoc.file_size ?? 0) / 1024).toFixed(1)} KB`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display:        "flex",
                    justifyContent: "space-between",
                    alignItems:     "center",
                  }}
                >
                  <span
                    style={{
                      fontSize:   12,
                      color:      "var(--color-text-muted)",
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 13 }}>{value}</span>
                </div>
              ))}

              {/* Hash display */}
              <div>
                <label className="bv-label" style={{ marginBottom: 6 }}>
                  SHA-256 Document Hash
                </label>
                <div className="bv-hash" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Hash size={13} color="var(--color-brand)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>{uploadedDoc.document_hash}</span>
                </div>
              </div>

              <div>
                <label className="bv-label" style={{ marginBottom: 6 }}>
                  Public Verification Link
                </label>
                <div className="bv-hash">{publicVerifyUrl}</div>
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <QrCode size={16} color="var(--color-brand-bright)" />
                <p style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700 }}>
                  QR-Based Public Verification
                </p>
              </div>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginBottom: 14 }}>
                Share this QR or link so anyone can validate the blockchain record without logging in.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 18,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    width: 148,
                    height: 148,
                    padding: 10,
                    borderRadius: "var(--radius-md)",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={qrImageUrl}
                    alt="QR code for public verification page"
                    width={128}
                    height={128}
                    style={{ width: 128, height: 128, display: "block" }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button onClick={handleCopyVerifyLink} className="bv-btn bv-btn--primary">
                      <Copy size={15} />
                      Copy Public Link
                    </button>
                    <Link
                      href={publicVerifyPath}
                      className="bv-btn bv-btn--ghost"
                      style={{ textDecoration: "none" }}
                    >
                      <ExternalLink size={15} />
                      Open Public Verify Page
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={handleReset}
                className="bv-btn bv-btn--primary"
                style={{ flex: 1 }}
              >
                <RotateCcw size={15} />
                Upload Another
              </button>
              <Link
                href="/verify"
                className="bv-btn bv-btn--ghost"
                style={{ flex: 1, textDecoration: "none" }}
              >
                Verify Document
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ── Default upload state ──────────────────────────── */
  return (
    <AppLayout>
      <div style={{ padding: "36px 40px", maxWidth: 680 }}>

        {/* Page header */}
        <div className="fade-up" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, marginBottom: 5 }}>Upload Document</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Register your document on the blockchain for immutable proof of authenticity
          </p>
        </div>

        {/* Dropzone area */}
        <div
          {...getRootProps()}
          className={`bv-dropzone fade-up delay-1 ${
            isDragActive  ? "bv-dropzone--active" :
            selectedFile  ? "bv-dropzone--filled" : ""
          }`}
          style={{ marginBottom: 20 }}
        >
          <input {...getInputProps()} />

          <div className="float" style={{ marginBottom: 14 }}>
            {selectedFile ? (
              <FileText size={44} color="var(--color-success)" style={{ margin: "0 auto" }} />
            ) : (
              <CloudUpload
                size={44}
                color={isDragActive ? "var(--color-brand)" : "var(--color-text-muted)"}
                style={{ margin: "0 auto", opacity: isDragActive ? 1 : 0.5 }}
              />
            )}
          </div>

          {selectedFile ? (
            <>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize:   16,
                  color:      "var(--color-success)",
                  marginBottom: 4,
                }}
              >
                {selectedFile.name}
              </p>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {fileSizeLabel} · {selectedFile.type || "Unknown type"}
              </p>
            </>
          ) : isDragActive ? (
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize:   16,
                color:      "var(--color-brand-bright)",
              }}
            >
              Drop to select
            </p>
          ) : (
            <>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize:   16,
                  marginBottom: 6,
                }}
              >
                Drag & drop your file here
              </p>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
                or click to browse
              </p>
              <p style={{ fontSize: 11, color: "var(--color-text-disabled)" }}>
                PDF, JPG, PNG, WEBP, DOC, DOCX · Max 50 MB
              </p>
            </>
          )}
        </div>

        {/* How it works */}
        <div className="bv-card fade-up delay-2" style={{ padding: 20, marginBottom: 20 }}>
          <label className="bv-label" style={{ marginBottom: 14 }}>
            How It Works
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {UPLOAD_STEPS.map(({ number, title, desc }) => (
              <div key={number} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{
                    width:    24,
                    height:   24,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-brand-dim)",
                    border:   "1px solid rgba(124,111,247,0.3)",
                    display:  "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize:  10,
                    fontWeight: 600,
                    color:     "var(--color-brand-bright)",
                  }}
                >
                  {number}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "var(--font-display)",
                      marginBottom: 2,
                    }}
                  >
                    {title}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="bv-alert bv-alert--danger fade-in" style={{ marginBottom: 16 }}>
            <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="fade-up delay-3" style={{ display: "flex", gap: 12 }}>
          <button
            className="bv-btn bv-btn--primary"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            style={{ flex: 1, padding: "13px 22px" }}
          >
            {isUploading ? (
              <><Loader2 size={16} className="spin" /> Mining block…</>
            ) : (
              <><Upload size={15} /> Register on Blockchain</>
            )}
          </button>

          {selectedFile && !isUploading && (
            <button
              className="bv-btn bv-btn--ghost"
              onClick={handleReset}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
