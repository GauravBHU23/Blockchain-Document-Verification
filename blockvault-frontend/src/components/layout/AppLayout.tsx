"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Menu,
  LayoutDashboard,
  Upload,
  Search,
  Layers,
  Activity,
  LogOut,
  PencilLine,
  Check,
  X,
  BadgeCheck,
  BadgeX,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

/* ── Navigation config ────────────────────────────────────── */
const NAV_ITEMS = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/ops",        icon: Activity,        label: "Operations" },
  { href: "/upload",     icon: Upload,           label: "Upload"     },
  { href: "/verify",     icon: Search,           label: "Verify"     },
  { href: "/blockchain", icon: Layers,           label: "Blockchain" },
] as const;

/* ── Component ────────────────────────────────────────────── */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, logout, hydrate, setUser } = useAuthStore();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.replace("/auth");
    }
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/auth");
  };

  useEffect(() => {
    setProfileName(user?.name ?? "");
    setProfileEmail(user?.email ?? "");
  }, [user?.name, user?.email]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const isNavActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const userInitial = user?.name?.charAt(0).toUpperCase() ?? "U";
  const displayRole = user?.is_admin ? "Administrator" : user?.email_verified ? "Verified user" : "Unverified user";

  const handleSaveProfile = async () => {
    const nextName = profileName.trim();
    const nextEmail = profileEmail.trim();

    if (!nextName || !nextEmail) {
      toast.error("Name and email are required");
      return;
    }

    try {
      setIsSavingProfile(true);
      const response = await authApi.updateMe(nextName, nextEmail);
      setUser(response.data);
      setIsEditingProfile(false);
      toast.success("Profile updated");
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object" &&
        (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Could not update profile";
      toast.error(typeof message === "string" ? message : "Could not update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileName(user?.name ?? "");
    setProfileEmail(user?.email ?? "");
    setIsEditingProfile(false);
  };

  return (
    <div className="bv-app-shell">
      <style>{`
        .bv-app-shell {
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }
        .bv-app-sidebar {
          width: 228px;
          flex-shrink: 0;
          background: var(--color-bg-surface);
          border-right: 1px solid var(--color-border-subtle);
          display: flex;
          flex-direction: column;
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 50;
          transition: transform var(--transition-normal);
        }
        .bv-app-main {
          margin-left: 228px;
          min-height: 100vh;
        }
        .bv-mobile-topbar,
        .bv-mobile-bottomnav,
        .bv-mobile-overlay {
          display: none;
        }
        @media (max-width: 960px) {
          .bv-sidebar-close {
            display: flex !important;
          }
          .bv-app-sidebar {
            width: min(84vw, 320px);
            transform: translateX(-100%);
            box-shadow: var(--shadow-modal);
          }
          .bv-app-sidebar--open {
            transform: translateX(0);
          }
          .bv-app-main {
            margin-left: 0;
            padding-top: 72px;
            padding-bottom: 88px;
          }
          .bv-mobile-topbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 60;
            height: 72px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            background: rgba(7, 7, 15, 0.92);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--color-border-subtle);
          }
          .bv-mobile-bottomnav {
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: 12px;
            z-index: 60;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px;
            padding: 8px;
            background: rgba(13, 13, 26, 0.92);
            backdrop-filter: blur(16px);
            border: 1px solid var(--color-border-subtle);
            border-radius: 22px;
            box-shadow: var(--shadow-modal);
          }
          .bv-mobile-bottomnav a {
            min-width: 0;
          }
          .bv-mobile-bottomnav-label {
            font-size: 10px;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .bv-mobile-overlay {
            position: fixed;
            inset: 0;
            z-index: 45;
            display: block;
            background: rgba(3, 5, 12, 0.56);
            backdrop-filter: blur(6px);
          }
        }
      `}</style>

      <div className="bv-mobile-topbar">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="bv-btn bv-btn--ghost"
          style={{ padding: 10, borderRadius: 14 }}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-success) 100%)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(124,111,247,0.3)",
              flexShrink: 0,
            }}
          >
            <Shield size={17} color="#fff" />
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "-0.025em",
            }}
          >
            Block<span style={{ color: "var(--color-brand-bright)" }}>Vault</span>
          </span>
        </Link>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-brand), var(--color-success))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {userInitial}
        </div>
      </div>

      {isSidebarOpen && <div className="bv-mobile-overlay" onClick={() => setIsSidebarOpen(false)} />}
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside
        className={`bv-app-sidebar ${isSidebarOpen ? "bv-app-sidebar--open" : ""}`}
        style={{
          padding: "0",
        }}
      >

        {/* Logo section */}
        <div
          style={{
            padding: "22px 20px",
            borderBottom: "1px solid var(--color-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width:  36,
                height: 36,
                background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-success) 100%)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 4px 14px rgba(124,111,247,0.3)",
              }}
            >
              <Shield size={17} color="#fff" />
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize:   18,
                letterSpacing: "-0.025em",
              }}
            >
              Block<span style={{ color: "var(--color-brand-bright)" }}>Vault</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid var(--color-border-subtle)",
              background: "var(--color-bg-elevated)",
              color: "var(--color-text-muted)",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            className="bv-sidebar-close"
            aria-label="Close navigation"
          >
            <X size={15} />
          </button>
        </div>

        {/* Navigation links */}
        <nav
          style={{
            flex:    1,
            padding: "14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "var(--color-text-disabled)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "4px 12px 8px",
            }}
          >
            Navigation
          </p>

          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`bv-nav-link ${isNavActive(href) ? "bv-nav-link--active" : ""}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User profile + logout */}
        <div
          style={{
            padding:    "12px",
            borderTop:  "1px solid var(--color-border-subtle)",
            display:    "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* User card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "12px",
              borderRadius:  "var(--radius-md)",
              background:    "var(--color-bg-elevated)",
              border:        "1px solid var(--color-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--color-brand), var(--color-success))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                }}
              >
                {userInitial}
              </div>

              <div style={{ overflow: "hidden", flex: 1 }}>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user?.name ?? "User"}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: 2,
                  }}
                >
                  {user?.email}
                </p>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    color: user?.email_verified ? "var(--color-brand-bright)" : "var(--color-warning)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                  }}
                >
                  {user?.email_verified ? <BadgeCheck size={11} /> : <BadgeX size={11} />}
                  {displayRole}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "1px solid var(--color-border-subtle)",
                  background: "var(--color-bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                aria-label="Edit profile"
                title="Edit profile"
              >
                <PencilLine size={14} />
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="bv-nav-link"
            style={{
              width: "100%",
              border: "1px solid var(--color-border-subtle)",
              background: "var(--color-bg-elevated)",
              justifyContent: "space-between",
              paddingRight: 12,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--color-danger-dim)",
                  color: "var(--color-danger)",
                }}
              >
                <LogOut size={14} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                <span>Sign Out</span>
                <span style={{ fontSize: 10, color: "var(--color-text-disabled)" }}>
                  End current session
                </span>
              </span>
            </span>
            <Shield size={14} color="var(--color-text-disabled)" />
          </button>
        </div>
      </aside>

      {/* ── Page content ──────────────────────────────── */}
      <main className="bv-app-main">
        {children}
      </main>

      <nav className="bv-mobile-bottomnav">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`bv-nav-link ${isNavActive(href) ? "bv-nav-link--active" : ""}`}
            style={{
              padding: "8px 6px",
              flexDirection: "column",
              gap: 6,
              justifyContent: "center",
              borderRadius: 16,
            }}
          >
            <Icon size={16} />
            <span className="bv-mobile-bottomnav-label">{label}</span>
          </Link>
        ))}
      </nav>

      {isEditingProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
          onClick={handleCancelEdit}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(5, 8, 20, 0.68)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            className="bv-card"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(100%, 460px)",
              padding: 24,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 28px 80px rgba(0, 0, 0, 0.42)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 18,
              }}
            >
              <div>
                <p
                  id="profile-edit-title"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    fontWeight: 800,
                    marginBottom: 6,
                  }}
                >
                  Edit Profile
                </p>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Update your account details from one place.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancelEdit}
                aria-label="Close profile editor"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1px solid var(--color-border-subtle)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                marginBottom: 18,
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--color-brand), var(--color-success))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {userInitial}
              </div>
              <div>
                <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                  {displayRole}
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  Changes update your active session immediately.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <BadgeCheck
                  size={13}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-disabled)",
                  }}
                />
                <input
                  className="bv-input"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Full name"
                  style={{ paddingLeft: 36, height: 44 }}
                />
              </div>

              <div style={{ position: "relative" }}>
                <Mail
                  size={13}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-disabled)",
                  }}
                />
                <input
                  className="bv-input"
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  placeholder="Email address"
                  disabled
                  style={{ paddingLeft: 36, height: 44 }}
                />
              </div>
              <p style={{ fontSize: 11, color: "var(--color-text-disabled)", marginTop: -4 }}>
                Verified email is locked for security.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="bv-btn bv-btn--primary"
                onClick={() => void handleSaveProfile()}
                disabled={isSavingProfile}
                style={{ flex: 1, justifyContent: "center" }}
              >
                <Check size={14} />
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className="bv-btn bv-btn--ghost"
                onClick={handleCancelEdit}
                disabled={isSavingProfile}
                style={{ flex: 1, justifyContent: "center" }}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
