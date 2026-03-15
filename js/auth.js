// ─── Authentication ───

let authData = null;

export async function loadAuthData() {
  const res = await fetch('data/auth.json');
  authData = await res.json();
}

export async function hashPassphrase(input) {
  const encoded = new TextEncoder().encode(input.toLowerCase().trim());
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function authenticate(input) {
  if (!authData) await loadAuthData();
  const hash = await hashPassphrase(input);
  const user = authData.users.find(u => u.hash === hash);
  return user ? user.id : null;
}
