export type Role = "user" | "admin";

const ROLE_KEY = "ai4support_role";

export function setRole(role: Role) {
  localStorage.setItem(ROLE_KEY, role);
}

export function getRole(): Role | null {
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "user" || role === "admin") return role;
  return null;
}

export function clearAuth() {
  localStorage.removeItem(ROLE_KEY);
}

export function isAuthed(): boolean {
  return getRole() !== null;
}
