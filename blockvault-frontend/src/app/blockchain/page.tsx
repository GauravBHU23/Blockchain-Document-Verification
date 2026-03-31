"use client";

import { useState, useEffect } from "react";
import {
  Layers, ShieldCheck, ShieldX, RefreshCw,
  Hash, FileCode, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import AppLayout from "@/components/layout/AppLayout";
import { blockchainApi } from "@/lib/api";
import type { ChainStatus, Block } from "@/types";

/* ── Page component ───────────────────────────────────────── */
export default function BlockchainPage() {
  const [chainData, setChainData]       = useState<ChainStatus | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadChain = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await blockchainApi.chain();
      setChainData(response.data);
    } catch (err) {
      console.error("Failed to load blockchain data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { loadChain(); }, []);

  const totalTransactions = chainData?.blocks.reduce(
    (sum, block) => sum + block.transactions.length, 0
  ) ?? 0;

  /* ── Render ───────────────────────────────────────── */
  return (
    <AppLayout>
      <div className="bv-page-shell">
        <style>{`
          .blockchain-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
            gap: 16px;
          }
          .blockchain-layout {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            align-items: start;
          }
          .blockchain-stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 24px;
          }
          @media (min-width: 1100px) {
            .blockchain-layout--detail {
              grid-template-columns: minmax(0, 1fr) 400px;
            }
          }
          @media (max-width: 780px) {
            .blockchain-header {
              flex-direction: column;
              align-items: flex-start;
            }
            .blockchain-header-actions {
              width: 100%;
              justify-content: space-between;
              flex-wrap: wrap;
            }
          }
          @media (max-width: 640px) {
            .blockchain-stats {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        {/* Page header */}
        <div
          className="fade-up blockchain-header"
        >
          <div>
            <h1 style={{ fontSize: 26, marginBottom: 5 }}>Blockchain Explorer</h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
              Browse blocks, transactions, and verify chain integrity
            </p>
          </div>

          <div className="blockchain-header-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Chain validity badge */}
            {chainData && (
              <div
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        7,
                  padding:    "8px 14px",
                  borderRadius: "var(--radius-md)",
                  background: chainData.is_valid
                    ? "var(--color-success-dim)"
                    : "var(--color-danger-dim)",
                  border: `1px solid ${
                    chainData.is_valid
                      ? "var(--color-success-border)"
                      : "var(--color-danger-border)"
                  }`,
                }}
              >
                {chainData.is_valid ? (
                  <ShieldCheck size={15} color="var(--color-success)" />
                ) : (
                  <ShieldX size={15} color="var(--color-danger)" />
                )}
                <span
                  style={{
                    fontSize:   12,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    color:      chainData.is_valid
                      ? "var(--color-success)"
                      : "var(--color-danger)",
                  }}
                >
                  {chainData.is_valid ? "Chain Valid" : "Chain Tampered!"}
                </span>
              </div>
            )}

            <button
              className="bv-btn bv-btn--ghost"
              onClick={() => loadChain(true)}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="bv-empty">
            <p className="bv-empty__desc">Loading blockchain data…</p>
          </div>
        ) : (
          <div className={`blockchain-layout ${selectedBlock ? "blockchain-layout--detail" : ""}`}>
            {/* ── Left: Stats + Block list ─────────────── */}
            <div>
              {/* Summary stats */}
              <div className="fade-up delay-1 blockchain-stats">
                {[
                  { label: "Total Blocks",       value: chainData?.length,             color: "var(--color-brand-bright)"  },
                  { label: "Total Transactions", value: totalTransactions,              color: "var(--color-success)"       },
                  { label: "Pending TX",         value: chainData?.pending_transactions, color: "var(--color-warning)"      },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bv-card" style={{ padding: "16px 18px" }}>
                    <p className="bv-stat-value" style={{ color }}>{value}</p>
                    <p className="bv-stat-label">{label}</p>
                  </div>
                ))}
              </div>

              {/* Block list */}
              <div
                className="fade-up delay-2"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {[...(chainData?.blocks ?? [])].reverse().map((block) => {
                  const isSelected  = selectedBlock?.index === block.index;
                  const isGenesis   = block.index === 1;
                  const isLatest    = block.index === chainData?.length;

                  return (
                    <div
                      key={block.index}
                      className={`bv-card ${isSelected ? "bv-card--active" : ""}`}
                      onClick={() =>
                        setSelectedBlock(isSelected ? null : block)
                      }
                      style={{ padding: "16px 20px", cursor: "pointer" }}
                    >
                      <div
                        style={{
                          display:        "flex",
                          alignItems:     "center",
                          justifyContent: "space-between",
                        }}
                      >
                        {/* Left: icon + block info */}
                        <div
                          style={{ display: "flex", alignItems: "center", gap: 14 }}
                        >
                          <div
                            style={{
                              width:    38,
                              height:   38,
                              borderRadius: "var(--radius-md)",
                              background: isGenesis
                                ? "var(--color-warning-dim)"
                                : "var(--color-brand-dim)",
                              border: `1px solid ${
                                isGenesis
                                  ? "var(--color-warning-border)"
                                  : "rgba(124,111,247,0.25)"
                              }`,
                              display:        "flex",
                              alignItems:     "center",
                              justifyContent: "center",
                              flexShrink:     0,
                            }}
                          >
                            <Layers
                              size={16}
                              color={isGenesis ? "var(--color-warning)" : "var(--color-brand-bright)"}
                            />
                          </div>

                          <div>
                            <div
                              style={{
                                display:    "flex",
                                alignItems: "center",
                                gap:        8,
                                marginBottom: 3,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--font-display)",
                                  fontWeight: 700,
                                  fontSize:   14,
                                }}
                              >
                                Block #{block.index}
                              </span>
                              {isGenesis && (
                                <span
                                  style={{
                                    fontSize:   10,
                                    fontFamily: "var(--font-display)",
                                    fontWeight: 700,
                                    color:      "var(--color-warning)",
                                    background: "var(--color-warning-dim)",
                                    padding:    "2px 7px",
                                    borderRadius: "var(--radius-full)",
                                    border:     "1px solid var(--color-warning-border)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Genesis
                                </span>
                              )}
                              {isLatest && !isGenesis && (
                                <span
                                  style={{
                                    fontSize:   10,
                                    fontFamily: "var(--font-display)",
                                    fontWeight: 700,
                                    color:      "var(--color-brand-bright)",
                                    background: "var(--color-brand-dim)",
                                    padding:    "2px 7px",
                                    borderRadius: "var(--radius-full)",
                                    border:     "1px solid rgba(124,111,247,0.3)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Latest
                                </span>
                              )}
                            </div>
                            <p
                              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                            >
                              {format(new Date(block.timestamp * 1000), "MMM d, yyyy · HH:mm:ss")}
                            </p>
                          </div>
                        </div>

                        {/* Right: tx count + hash preview */}
                        <div
                          style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 12 }}
                        >
                          <div>
                            <p
                              style={{
                                fontSize:   13,
                                fontFamily: "var(--font-display)",
                                fontWeight: 700,
                                color:      "var(--color-brand-bright)",
                              }}
                            >
                              {block.transactions.length} TX
                            </p>
                            <p
                              className="font-mono"
                              style={{
                                fontSize: 10,
                                color:    "var(--color-text-disabled)",
                                marginTop: 2,
                              }}
                            >
                              {block.previous_hash.slice(0, 12)}…
                            </p>
                          </div>
                          <ChevronRight
                            size={15}
                            color="var(--color-text-muted)"
                            style={{
                              transform: isSelected ? "rotate(90deg)" : "none",
                              transition: "transform var(--transition-fast)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Right: Block detail panel ─────────────── */}
            {selectedBlock && (
              <div
                className="bv-card scale-in"
                style={{
                  padding:  24,
                  position: "sticky",
                  top:      24,
                }}
              >
                {/* Panel header */}
                <div
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    marginBottom:   20,
                  }}
                >
                  <h3 style={{ fontSize: 16 }}>Block #{selectedBlock.index}</h3>
                  <button
                    onClick={() => setSelectedBlock(null)}
                    style={{
                      background:   "none",
                      border:       "none",
                      color:        "var(--color-text-muted)",
                      cursor:       "pointer",
                      fontSize:     20,
                      lineHeight:   1,
                      padding:      "2px 6px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    ×
                  </button>
                </div>

                <hr className="bv-divider" style={{ marginBottom: 18 }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Proof */}
                  <div>
                    <label className="bv-label">Proof of Work</label>
                    <p className="font-mono" style={{ fontSize: 13 }}>
                      {selectedBlock.proof.toLocaleString()}
                    </p>
                  </div>

                  {/* Previous hash */}
                  <div>
                    <label className="bv-label">Previous Hash</label>
                    <div className="bv-hash">{selectedBlock.previous_hash}</div>
                  </div>

                  {/* Transactions */}
                  <div>
                    <label className="bv-label">
                      Transactions ({selectedBlock.transactions.length})
                    </label>

                    {selectedBlock.transactions.length === 0 ? (
                      <p
                        style={{
                          fontSize: 13,
                          color:    "var(--color-text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        No transactions (genesis block)
                      </p>
                    ) : (
                      <div
                        style={{
                          display:       "flex",
                          flexDirection: "column",
                          gap:           8,
                        }}
                      >
                        {selectedBlock.transactions.map((tx, index) => (
                          <div
                            key={index}
                            style={{
                              padding:      12,
                              borderRadius: "var(--radius-md)",
                              background:   "var(--color-bg-surface)",
                              border:       "1px solid var(--color-border-subtle)",
                            }}
                          >
                            {/* TX ID */}
                            <div
                              style={{
                                display:     "flex",
                                alignItems:  "center",
                                gap:         6,
                                marginBottom: 8,
                              }}
                            >
                              <FileCode size={13} color="var(--color-brand-bright)" />
                              <span
                                className="font-mono"
                                style={{
                                  fontSize: 11,
                                  color:    "var(--color-brand-bright)",
                                }}
                              >
                                {tx.tx_id?.slice(0, 18)}…
                              </span>
                            </div>

                            {/* Uploader */}
                            <p
                              style={{
                                fontSize:    12,
                                color:       "var(--color-text-muted)",
                                marginBottom: 7,
                              }}
                            >
                              {tx.uploader_email ?? "Unknown"}
                            </p>

                            {/* Document hash */}
                            <div className="bv-hash" style={{ fontSize: 10, padding: "6px 10px" }}>
                              <Hash
                                size={11}
                                style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }}
                              />
                              {tx.document_hash?.slice(0, 36)}…
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
