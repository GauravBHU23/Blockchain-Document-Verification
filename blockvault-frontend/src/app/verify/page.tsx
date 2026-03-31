"use client";

import { useState, useCallback } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";
import {
  Search, ShieldCheck, ShieldX, Hash, Loader2,
  Upload, FileSearch, Calendar, User, Layers,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import AppLayout from "@/components/layout/AppLayout";
import { documentsApi } from "@/lib/api";
import type { VerifyResult } from "@/types";

/* ── Types ────────────────────────────────────────────── */
type VerifyMode = "hash" | "file";

/* ── Page component ───────────────────────────────────── */
export default function VerifyPage() {
  const [verifyMode, setVerifyMode]   = useState<VerifyMode>("hash");
  const [hashInput, setHashInput]     = useState("");
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  /* Dropzone setup */
  const onFileDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setDroppedFile(acceptedFiles[0]);
      setVerifyResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop:   onFileDrop,
    maxFiles: 1,
  });

  /* Switch mode */
  const switchMode = (mode: VerifyMode) => {
    setVerifyMode(mode);
    setVerifyResult(null);
    setHashInput("");
    setDroppedFile(null);
  };

  /* Compute SHA-256 from file using Web Crypto API */
  const computeFileHash = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer  = await crypto.subtle.digest("SHA-256", arrayBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  /* Verify handler */
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      let resolvedHash = hashInput.trim();

      if (verifyMode === "file") {
        if (!droppedFile) { toast.error("Please select a file"); return; }
        resolvedHash = await computeFileHash(droppedFile);
      } else {
        if (!resolvedHash) { toast.error("Please enter a hash"); return; }
      }

      const response = await documentsApi.verifyHash(resolvedHash);
      setVerifyResult(response.data);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail ?? "Verification request failed"
        : "Verification request failed";
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const canVerify =
    verifyMode === "hash" ? hashInput.trim().length > 0 : droppedFile !== null;

  /* ── Render ───────────────────────────────────────── */
  return (
    <AppLayout>
      <div className="bv-page-shell" style={{ maxWidth: 680 }}>
        <style>{`
          .verify-mode-toggle {
            display: flex;
            background: var(--color-bg-surface);
            border-radius: var(--radius-md);
            padding: 4px;
            margin-bottom: 22px;
            width: fit-content;
            gap: 4px;
          }
          @media (max-width: 640px) {
            .verify-mode-toggle {
              width: 100%;
            }
            .verify-mode-toggle button {
              flex: 1;
              justify-content: center;
            }
          }
        `}</style>

        {/* Page header */}
        <div className="fade-up" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, marginBottom: 5 }}>Verify Document</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Confirm whether a document hash exists on the immutable blockchain ledger
          </p>
        </div>

        {/* Mode toggle */}
        <div className="fade-up delay-1 verify-mode-toggle">
          {(["hash", "file"] as VerifyMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        6,
                padding:    "8px 20px",
                borderRadius: "var(--radius-sm)",
                border:     "none",
                background: verifyMode === mode ? "var(--color-bg-overlay)" : "transparent",
                color:      verifyMode === mode ? "var(--color-text-primary)" : "var(--color-text-muted)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize:   13,
                cursor:     "pointer",
                transition: "all var(--transition-fast)",
                boxShadow:  verifyMode === mode ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {mode === "hash" ? <Hash size={14} /> : <Upload size={14} />}
              {mode === "hash" ? "By Hash" : "By File"}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="bv-card fade-up delay-2" style={{ padding: 24, marginBottom: 18 }}>
          {verifyMode === "hash" ? (
            <div>
              <label className="bv-label">SHA-256 Hash</label>
              <div className="bv-input-wrapper">
                <Hash size={15} className="bv-input-icon bv-input-icon--left" />
                <input
                  className="bv-input bv-input--icon-left font-mono"
                  style={{ fontSize: 13 }}
                  placeholder="e4d909c290d0fb1ca068ffaddf22cbd0…"
                  value={hashInput}
                  onChange={(e) => { setHashInput(e.target.value); setVerifyResult(null); }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`bv-dropzone ${
                isDragActive ? "bv-dropzone--active" :
                droppedFile  ? "bv-dropzone--filled" : ""
              }`}
              style={{ padding: "28px 24px" }}
            >
              <input {...getInputProps()} />
              <FileSearch
                size={30}
                color={droppedFile ? "var(--color-success)" : "var(--color-text-muted)"}
                style={{ margin: "0 auto 10px", opacity: droppedFile ? 1 : 0.5 }}
              />
              {droppedFile ? (
                <>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      color:      "var(--color-success)",
                      fontSize:   14,
                    }}
                  >
                    {droppedFile.name}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                    Hash computed locally · file is not uploaded
                  </p>
                </>
              ) : (
                <>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize:   15,
                      marginBottom: 4,
                    }}
                  >
                    Drop file to verify
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    SHA-256 hash computed in your browser — file never leaves your device
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Verify button */}
        <button
          className="bv-btn bv-btn--primary fade-up delay-3"
          onClick={handleVerify}
          disabled={isVerifying || !canVerify}
          style={{ width: "100%", padding: "13px 22px" }}
        >
          {isVerifying ? (
            <><Loader2 size={16} className="spin" /> Querying blockchain…</>
          ) : (
            <><Search size={15} /> Verify Authenticity</>
          )}
        </button>

        {/* ── Result panel ──────────────────────────── */}
        {verifyResult && (
          <div
            className="bv-card scale-in"
            style={{
              marginTop:   24,
              padding:     28,
              borderColor: verifyResult.verified
                ? "var(--color-success-border)"
                : "var(--color-danger-border)",
              background: verifyResult.verified
                ? "rgba(5,214,158,0.03)"
                : "rgba(240,82,118,0.03)",
            }}
          >
            {/* Result header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <div
                style={{
                  width:    50,
                  height:   50,
                  borderRadius: "50%",
                  background: verifyResult.verified
                    ? "var(--color-success-dim)"
                    : "var(--color-danger-dim)",
                  border: `2px solid ${
                    verifyResult.verified
                      ? "var(--color-success)"
                      : "var(--color-danger)"
                  }`,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  flexShrink:     0,
                }}
              >
                {verifyResult.verified ? (
                  <ShieldCheck size={22} color="var(--color-success)" />
                ) : (
                  <ShieldX size={22} color="var(--color-danger)" />
                )}
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize:   17,
                    color:      verifyResult.verified
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                    marginBottom: 3,
                  }}
                >
                  {verifyResult.verified
                    ? "Document Verified ✓"
                    : "Not Found on Blockchain"}
                </p>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  {verifyResult.message}
                </p>
              </div>
            </div>

            {/* Verified details */}
            {verifyResult.verified && (
              <>
                <hr className="bv-divider" style={{ marginBottom: 18 }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {[
                    {
                      icon:  <Layers size={14} />,
                      label: "Block Index",
                      value: `#${verifyResult.block_index}`,
                    },
                    {
                      icon:  <Calendar size={14} />,
                      label: "Block Timestamp",
                      value: verifyResult.block_timestamp
                        ? format(new Date(verifyResult.block_timestamp * 1000), "PPpp")
                        : "—",
                    },
                    {
                      icon:  <User size={14} />,
                      label: "Uploaded By",
                      value: verifyResult.uploader_email ?? "Unknown",
                    },
                    {
                      icon:  <FileSearch size={14} />,
                      label: "File Name",
                      value: verifyResult.original_name ?? "—",
                    },
                  ].map(({ icon, label, value }) => (
                    <div
                      key={label}
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <span style={{ color: "var(--color-brand-bright)", flexShrink: 0 }}>
                        {icon}
                      </span>
                      <span
                        style={{
                          minWidth:   96,
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

                  <div style={{ marginTop: 4 }}>
                    <label className="bv-label" style={{ marginBottom: 7 }}>
                      Document Hash
                    </label>
                    <div className="bv-hash">{verifyResult.document_hash}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
