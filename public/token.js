const TOKEN_KEY = "sq_anon_token";

export function getOrCreateAnonymousToken() {
  let token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, token);
  }

  return token;
}
