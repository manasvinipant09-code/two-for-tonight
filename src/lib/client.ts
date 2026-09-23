"use client";

const PARTNER_ID_KEY = "tft_partner_id";

/** A stable per-device id, independent of any one session, used to build a
 * taste history over time. Not an account — just enough to say "this device
 * has been part of these sessions before." */
export function getOrCreatePartnerId(): string | null {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(PARTNER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PARTNER_ID_KEY, id);
  }
  return id;
}

export function storePartnerId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARTNER_ID_KEY, id);
}

export function getRoleForSession(sessionId: string): "A" | "B" | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(`tft_role_${sessionId}`) as "A" | "B" | null) ?? null;
}

export function storeRoleForSession(sessionId: string, role: "A" | "B") {
  if (typeof window === "undefined") return;
  localStorage.setItem(`tft_role_${sessionId}`, role);
}
