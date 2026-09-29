export function allowedOrigin(origin: string | null | undefined) {
  const allowed = (
    process.env.ALLOWED_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:2567,http://127.0.0.1:2567"
  ).split(",");
  return !origin || allowed.includes(origin);
}
