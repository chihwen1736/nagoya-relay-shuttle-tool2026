export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 後備方案（極舊瀏覽器），一般 Windows 版 Chrome/Edge 都支援 crypto.randomUUID
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
