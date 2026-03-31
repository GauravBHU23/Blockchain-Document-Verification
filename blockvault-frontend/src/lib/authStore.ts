"use client";

import { create } from "zustand";
import type { User } from "@/types";

/* ── State interface ────────────────────────────────────── */
interface AuthStore {
  user:  User | null;
  token: string | null;

  /** Persist token + user to localStorage and update state */
  setAuth: (token: string, user: User) => void;

  /** Clear auth data from localStorage and state */
  logout: () => void;

  /** Rehydrate state from localStorage on app boot */
  hydrate: () => void;

  /** Update user details in state and storage */
  setUser: (user: User) => void;
}

/* ── Store ──────────────────────────────────────────────── */
export const useAuthStore = create<AuthStore>((set) => ({
  user:  null,
  token: null,

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user",  JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null });
  },

  hydrate: () => {
    const token   = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");

    if (token && rawUser) {
      try {
        set({ token, user: JSON.parse(rawUser) as User });
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  },

  setUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));
    set((state) => ({ ...state, user }));
  },
}));
