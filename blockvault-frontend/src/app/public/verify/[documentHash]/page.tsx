"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  ShieldCheck,
  ShieldX,
  Layers,
  Calendar,
  User,
  FileSearch,
  Hash,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { documentsApi } from "@/lib/api";
import { buildPublicVerifyUrl, buildQrImageUrl } from "@/lib/verification";
import type { VerifyResult } from "@/types";

export default function PublicVerifyPage() {
  const params = useParams<{ documentHash: string }>();
  const documentHash = decodeURIComponent(params.documentHash);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadVerification = async () => {
      setIsLoading(true);
      try {
        const response = await documentsApi.verifyHash(documentHash);
        if (mounted) {
          setResult(response.data);
        }
      } catch {
        if (mounted) {
          setResult({
            verified: false,
            document_hash: documentHash,
            message: "Verification lookup failed. Please try again in a moment.",
          });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadVerification();

    return () => {
      mounted = false;
    };
  }, [documentHash]);

  const shareUrl = buildPublicVerifyUrl(documentHash);
  const qrImageUrl = buildQrImageUrl(shareUrl);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Public verification link copied");
    } catch {
      toast.error("Could not copy the verification link");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 920 }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-brand-bright)",
              marginBottom: 10,
            }}
          >
            Public Verification Portal
          </p>
          <h1 style={{ fontSize: 34, marginBottom: 8 }}>BlockVault authenticity check</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
            Anyone with this link can confirm whether the document hash exists on the blockchain.
          </p>
        </div>

        <div
          className="bv-card"
          style={{
            padding: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 24,
          }}
        >
          <div>
            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 220 }}>
                <Loader2 size={18} className="spin" />
                <span style={{ color: "var(--color-text-muted)" }}>Checking blockchain record...</span>
              </div>
            ) : result && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: result.verified
                        ? "var(--color-success-dim)"
                        : "var(--color-danger-dim)",
                      border: `2px solid ${
                        result.verified ? "var(--color-success)" : "var(--color-danger)"
                      }`,
                      flexShrink: 0,
                    }}
                  >
                    {result.verified ? (
                      <ShieldCheck size={24} color="var(--color-success)" />
                    ) : (
                      <ShieldX size={24} color="var(--color-danger)" />
                    )}
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 20,
                        color: result.verified ? "var(--color-success)" : "var(--color-danger)",
                        marginBottom: 4,
                      }}
                    >
                      {result.verified ? "Verified on blockchain" : "Record not found"}
                    </p>
                    <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{result.message}</p>
                  </div>
                </div>

                <hr className="bv-divider" style={{ marginBottom: 18 }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {[
                    { icon: <Layers size={14} />, label: "Block Index", value: result.block_index ? `#${result.block_index}` : "-" },
                    {
                      icon: <Calendar size={14} />,
                      label: "Timestamp",
                      value: result.block_timestamp
                        ? format(new Date(result.block_timestamp * 1000), "PPpp")
                        : "-",
                    },
                    { icon: <User size={14} />, label: "Uploaded By", value: result.uploader_email ?? "-" },
                    { icon: <FileSearch size={14} />, label: "File Name", value: result.original_name ?? "-" },
                  ].map(({ icon, label, value }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: "var(--color-brand-bright)", flexShrink: 0 }}>{icon}</span>
                      <span
                        style={{
                          minWidth: 98,
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                        }}
                      >
                        {label}
                      </span>
                      <span style={{ fontSize: 13 }}>{value}</span>
                    </div>
                  ))}

                  <div style={{ marginTop: 6 }}>
                    <label className="bv-label" style={{ marginBottom: 7 }}>
                      Document Hash
                    </label>
                    <div className="bv-hash" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Hash size={13} color="var(--color-brand)" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{result.document_hash}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <aside
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 18,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 10,
              }}
            >
              Shareable proof
            </p>

            <div
              style={{
                background: "#fff",
                borderRadius: "var(--radius-md)",
                padding: 12,
                marginBottom: 14,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <img
                src={qrImageUrl}
                alt="QR code for public verification link"
                width={220}
                height={220}
                style={{ display: "block", width: "100%", maxWidth: 220, height: "auto" }}
              />
            </div>

            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
              Scan this QR code or open the link below to verify the document publicly.
            </p>

            <div className="bv-hash" style={{ fontSize: 11, marginBottom: 14 }}>{shareUrl}</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="bv-btn bv-btn--primary" onClick={copyLink} style={{ flex: 1 }}>
                <Copy size={14} />
                Copy Link
              </button>
              <Link
                href="/verify"
                className="bv-btn bv-btn--ghost"
                style={{ flex: 1, textDecoration: "none" }}
              >
                <ExternalLink size={14} />
                Private Verify
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
