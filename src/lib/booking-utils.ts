export const pad = (n: number) => String(n).padStart(2, "0");

export const keyOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (k: string) => {
  const parts = k.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
};

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export const HOURS: number[] = Array.from({ length: 17 }, (_, i) => i + 6);

export function rangeLabel(hours: number[]): string {
  const hs = hours.slice().sort((a, b) => a - b);
  if (!hs.length) return "";
  const parts: string[] = [];
  let start = hs[0] as number;
  let prev = hs[0] as number;
  for (let i = 1; i <= hs.length; i++) {
    const cur = hs[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(`${pad(start)}:00-${pad(prev + 1)}:00`);
    if (cur === undefined) break;
    start = cur;
    prev = cur;
  }
  return parts.join(", ");
}
