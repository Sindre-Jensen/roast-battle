"use client";

const USER_ID_KEY = "roast-battle-user-id";

export function getOrCreateUserId() {
  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) {
    return existing;
  }

  const created =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  window.localStorage.setItem(USER_ID_KEY, created);
  return created;
}
