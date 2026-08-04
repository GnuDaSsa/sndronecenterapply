import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminSession = { admin?: boolean };

function sessionConfig() {
  const password = process.env["RESERVATION_SESSION_SECRET"];
  if (!password) throw new Error("RESERVATION_SESSION_SECRET is not set");
  return {
    password,
    name: "drone-room-admin",
    maxAge: 60 * 60 * 4,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

function pepper() {
  return process.env["RESERVATION_PW_PEPPER"] ?? "";
}

export function hashPassword(pw: string, salt?: string): string {
  const s = salt ?? randomBytes(12).toString("hex");
  const digest = createHash("sha256")
    .update(`${s}:${pepper()}:${pw}`, "utf8")
    .digest("hex");
  return `${s}$${digest}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt] = stored.split("$");
  if (!salt) return false;
  const a = Buffer.from(hashPassword(pw, salt));
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function checkAdminPassword(pw: string): boolean {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) return false;
  const a = createHash("sha256").update(pw, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function setAdminSession(value: boolean) {
  const session = await useSession<AdminSession>(sessionConfig());
  if (value) await session.update({ admin: true });
  else await session.clear();
}

export async function isAdmin(): Promise<boolean> {
  const session = await useSession<AdminSession>(sessionConfig());
  return session.data.admin === true;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("관리자 인증이 필요합니다.");
}

export type PublicReservation = {
  id: string;
  date: string;
  dept: string;
  ext: string;
  hours: number[];
};

type HourRow = { reservation_id: string; date: string; hour: number };

export async function loadPublicReservations(): Promise<PublicReservation[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("reservations")
    .select("id, date, dept, ext");
  if (error) throw new Error(error.message);
  const { data: hours, error: hErr } = await supabaseAdmin
    .from("reservation_hours")
    .select("reservation_id, date, hour");
  if (hErr) throw new Error(hErr.message);

  const byId = new Map<string, number[]>();
  ((hours ?? []) as HourRow[]).forEach((h) => {
    const list = byId.get(h.reservation_id) ?? [];
    list.push(h.hour);
    byId.set(h.reservation_id, list);
  });

  return (rows ?? [])
    .map((r) => ({
      id: r.id,
      date: r.date,
      dept: r.dept,
      ext: r.ext,
      hours: (byId.get(r.id) ?? []).sort((a, b) => a - b),
    }))
    .filter((r) => r.hours.length > 0);
}

export async function insertHours(
  reservationId: string,
  date: string,
  hours: number[],
) {
  return supabaseAdmin
    .from("reservation_hours")
    .insert(hours.map((hour) => ({ reservation_id: reservationId, date, hour })));
}
