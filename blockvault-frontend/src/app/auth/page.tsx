"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Shield, Eye, EyeOff, Loader2, ArrowRight, Mail, Lock, User, KeyRound, BadgeCheck } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

type AuthMode = "login" | "register";
type AuthStep = "credentials" | "verify";

export default function AuthPage() {
  const router = useRouter();
  const { setAuth, user, hydrate } = useAuthStore();

  const [mode, setMode]           = useState<AuthMode>("login");
  const [step, setStep]           = useState<AuthStep>("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingOTP, setIsResendingOTP] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData]   = useState({ name: "", email: "", password: "" });
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [otp, setOtp] = useState("");
  const [devOTP, setDevOTP] = useState<string | null>(null);

  useEffect(() => { hydrate(); }, []);
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user]);

  const updateField = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (step === "verify") {
        const response = await authApi.verifyEmail(verificationToken, otp);
        setAuth(response.data.access_token, response.data.user);
        toast.success("Email verified successfully");
        router.push("/dashboard");
        return;
      }

      if (mode === "login") {
        const response = await authApi.login(formData.email, formData.password);
        setAuth(response.data.access_token, response.data.user);
        toast.success("Welcome back!");
        router.push("/dashboard");
        return;
      }

      const response = await authApi.register(formData.name, formData.email, formData.password);
      setVerificationEmail(response.data.email);
      setVerificationToken(response.data.verification_token);
      setOtp("");
      setDevOTP(response.data.dev_otp ?? null);
      setStep("verify");
      toast.success(response.data.message);
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
      const verificationDetail =
        typeof detail === "object" && detail !== null
          ? detail as { message?: string; verification_token?: string; email?: string }
          : null;
      const validationMessage = Array.isArray(detail)
        ? detail
            .map((item) => (typeof item?.msg === "string" ? item.msg : null))
            .filter(Boolean)
            .join(", ")
        : null;
      const message = axios.isAxiosError(error) && error.code === "ECONNABORTED"
        ? "Request timed out. Please try again."
        : validationMessage
          ? validationMessage
          : typeof detail === "string"
            ? detail
            : typeof verificationDetail?.message === "string"
              ? verificationDetail.message
              : "Authentication failed. Please try again.";

      if (mode === "login" && message === "Email verification required") {
        setVerificationEmail(verificationDetail?.email ?? formData.email.trim());
        setOtp("");
        setDevOTP(null);
        setVerificationToken(verificationDetail?.verification_token ?? "");
        setStep("verify");
        toast.error("Verify your email before signing in");
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!verificationToken) return;

    try {
      setIsResendingOTP(true);
      const response = await authApi.resendVerification(verificationToken);
      setVerificationEmail(response.data.email);
      setVerificationToken(response.data.verification_token);
      setDevOTP(response.data.dev_otp ?? null);
      toast.success(response.data.message);
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
      toast.error(typeof detail === "string" ? detail : "Could not resend OTP");
    } finally {
      setIsResendingOTP(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setStep("credentials");
    setFormData({ name: "", email: "", password: "" });
    setShowPassword(false);
    setVerificationEmail("");
    setVerificationToken("");
    setOtp("");
    setDevOTP(null);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <style>{`
          @media (max-width: 520px) {
            .auth-otp-actions {
              flex-direction: column;
            }
          }
        `}</style>

        {/* ── Logo ─────────────────────────────────────── */}
        <div
          className="fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-success) 100%)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px rgba(124,111,247,0.35)",
            }}
          >
            <Shield size={22} color="#fff" />
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: "-0.03em",
            }}
          >
            Block<span style={{ color: "var(--color-brand-bright)" }}>Vault</span>
          </span>
        </div>

        {/* ── Card ─────────────────────────────────────── */}
        <div
          className="bv-card fade-up delay-1"
          style={{ padding: 32, boxShadow: "var(--shadow-modal)" }}
        >

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-md)",
              padding: 4,
              marginBottom: 28,
              gap: 4,
            }}
          >
            {(["login", "register"] as AuthMode[]).map((tab) => (
              <button
                key={tab}
                onClick={() => switchMode(tab)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: mode === tab ? "var(--color-bg-overlay)" : "transparent",
                  color: mode === tab ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  boxShadow: mode === tab ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, marginBottom: 6 }}>
              {step === "verify"
                ? "Verify your email"
                : mode === "login"
                  ? "Sign in to BlockVault"
                  : "Create your account"}
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              {step === "verify"
                ? "Enter the 6-digit OTP sent to your inbox to activate access."
                : mode === "login"
                  ? "Access your document verification dashboard"
                  : "Create the account first, then verify the email before login."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {step === "verify" ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <BadgeCheck size={18} color="var(--color-brand-bright)" />
                  <div>
                    <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                      Email verification pending
                    </p>
                    <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{verificationEmail}</p>
                  </div>
                </div>

                <div>
                  <label className="bv-label">One-Time Password</label>
                  <div className="bv-input-wrapper">
                    <KeyRound size={15} className="bv-input-icon bv-input-icon--left" />
                    <input
                      className="bv-input bv-input--icon-left"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                    />
                  </div>
                </div>

                {devOTP && (
                  <p style={{ fontSize: 12, color: "var(--color-warning)" }}>
                    Dev OTP: <span className="font-mono">{devOTP}</span>
                  </p>
                )}

                <div className="auth-otp-actions" style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="bv-btn bv-btn--ghost"
                    onClick={() => void handleResendOTP()}
                    disabled={isResendingOTP}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {isResendingOTP ? <Loader2 size={16} className="spin" /> : <Mail size={15} />}
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    className="bv-btn bv-btn--ghost"
                    onClick={() => {
                      setStep("credentials");
                      setOtp("");
                      setDevOTP(null);
                      setVerificationToken("");
                    }}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Back
                  </button>
                </div>
              </>
            ) : (
              <>
                {mode === "register" && (
              <div>
                <label className="bv-label">Full Name</label>
                <div className="bv-input-wrapper">
                  <User size={15} className="bv-input-icon bv-input-icon--left" />
                  <input
                    className="bv-input bv-input--icon-left"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={updateField("name")}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="bv-label">Email Address</label>
              <div className="bv-input-wrapper">
                <Mail size={15} className="bv-input-icon bv-input-icon--left" />
                <input
                  className="bv-input bv-input--icon-left"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={updateField("email")}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="bv-label">Password</label>
              <div className="bv-input-wrapper">
                <Lock size={15} className="bv-input-icon bv-input-icon--left" />
                <input
                  className="bv-input bv-input--icon-left bv-input--icon-right"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "register" ? "Min. 8 chars, 1 uppercase, 1 digit" : "••••••••"}
                  value={formData.password}
                  onChange={updateField("password")}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="bv-input-icon bv-input-icon--right"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ background: "none", border: "none" }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

              </>
            )}

            <button
              type="submit"
              className="bv-btn bv-btn--primary"
              disabled={isLoading}
              style={{ marginTop: 4, padding: "12px 22px", width: "100%" }}
            >
              {isLoading ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <>
                  {step === "verify" ? "Verify Email" : mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

         
        </div>

        {/* Footer note */}
        <p
          className="fade-up delay-2"
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: 12,
            color: "var(--color-text-muted)",
          }}
        >
          Email verification is required before account access is granted
        </p>
      </div>
    </main>
  );
}
