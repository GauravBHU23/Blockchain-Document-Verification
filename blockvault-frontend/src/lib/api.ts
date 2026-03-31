import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

/* ── Client setup ───────────────────────────────────────── */
const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://sie-subscriber-dylan-disabilities.trycloudflare.com",
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

/* ── Request interceptor — attach JWT ───────────────────── */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response interceptor — auto-logout on 401 ──────────── */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url ?? "");
    const isAuthFlowRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/verify-email") ||
      requestUrl.includes("/auth/resend-verification");

    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !isAuthFlowRequest &&
      localStorage.getItem("token")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export default apiClient;

/* ══════════════════════════════════════════════════════════
   Auth API
   ══════════════════════════════════════════════════════════ */
export const authApi = {
  /** Register a new user */
  register: (name: string, email: string, password: string) =>
    apiClient.post("/auth/register", { name, email, password }),

  /** Login and receive a JWT */
  login: (email: string, password: string) =>
    apiClient.post("/auth/login", { email, password }),

  /** Verify email OTP and receive a JWT */
  verifyEmail: (verificationToken: string, otp: string) =>
    apiClient.post("/auth/verify-email", { verification_token: verificationToken, otp }),

  /** Resend verification OTP */
  resendVerification: (verificationToken: string) =>
    apiClient.post("/auth/resend-verification", { verification_token: verificationToken }),

  /** Fetch current authenticated user */
  getMe: () => apiClient.get("/auth/me"),

  /** Update current authenticated user */
  updateMe: (name: string, email: string) =>
    apiClient.put("/auth/me", { name, email }),

  /** List all users for admin console */
  listUsers: () => apiClient.get("/auth/users"),

  /** Enable or disable a user account */
  updateUserStatus: (userId: number, isActive: boolean) =>
    apiClient.post(`/auth/users/${userId}/status`, { is_active: isActive }),

  /** Fetch user export metadata */
  usersExportMeta: () => apiClient.get("/auth/users/export"),

  /** Download user CSV export */
  downloadUsersExport: () =>
    apiClient.get("/auth/users/export/download", { responseType: "blob" }),
};

/* ══════════════════════════════════════════════════════════
   Documents API
   ══════════════════════════════════════════════════════════ */
export const documentsApi = {
  /** Upload a file and register its hash on the blockchain */
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /** Verify a document by its SHA-256 hash string */
  verifyHash: (documentHash: string) =>
    apiClient.get(`/documents/verify/${documentHash}`),

  /** List current user's uploaded documents */
  list: (skip = 0, limit = 20, search?: string, status?: string, includeArchived?: boolean) =>
    apiClient.get("/documents/", { params: { skip, limit, search, status, include_archived: includeArchived } }),

  /** Fetch summary metrics and recent document activity */
  summary: () => apiClient.get("/documents/summary"),

  /** Fetch full detail for a single document */
  detail: (documentId: number) => apiClient.get(`/documents/${documentId}`),

  /** Delete a document record by ID */
  review: (documentId: number, action: "approve" | "reject", notes?: string) =>
    apiClient.post(`/documents/${documentId}/review`, { action, notes }),

  archive: (documentId: number) =>
    apiClient.post(`/documents/${documentId}/archive`),

  restore: (documentId: number) =>
    apiClient.post(`/documents/${documentId}/restore`),
};

/* ══════════════════════════════════════════════════════════
   Blockchain API
   ══════════════════════════════════════════════════════════ */
export const blockchainApi = {
  /** Fetch full chain with all blocks and transactions */
  chain: () => apiClient.get("/blockchain/"),

  /** Validate chain integrity */
  validate: () => apiClient.get("/blockchain/validate"),
};
