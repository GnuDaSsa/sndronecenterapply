import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const hoursSchema = z.array(z.number().int().min(6).max(22)).min(1).max(17);
const pw4 = z.string().regex(/^\d{4}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  date: dateSchema,
  hours: hoursSchema,
  dept: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(20),
  ext: z.string().regex(/^\d{4}$/),
  pw: pw4,
});

export const listReservations = createServerFn({ method: "GET" }).handler(
  async () => {
    const { loadPublicReservations } = await import("./reservations.server");
    return { reservations: await loadPublicReservations() };
  },
);

export const createReservation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const { hashPassword, insertHours } = await import("./reservations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const uniqueHours = Array.from(new Set(data.hours)).sort((a, b) => a - b);
    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .insert({
        date: data.date,
        dept: data.dept,
        reserver_name: data.name,
        ext: data.ext,
        pw_hash: hashPassword(data.pw),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "예약을 저장하지 못했습니다." };

    const { error: hErr } = await insertHours(row.id, data.date, uniqueHours);
    if (hErr) {
      await supabaseAdmin.from("reservations").delete().eq("id", row.id);
      return {
        ok: false as const,
        error: "선택한 시간에 이미 다른 예약이 있습니다. 다시 확인해 주세요.",
      };
    }
    return { ok: true as const, id: row.id };
  });

export const verifyReservation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), pw: pw4 }).parse(input),
  )
  .handler(async ({ data }) => {
    const { verifyPassword } = await import("./reservations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("reservations")
      .select("id, date, dept, reserver_name, ext, pw_hash")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "예약을 찾을 수 없습니다." };
    if (!verifyPassword(data.pw, row.pw_hash))
      return { ok: false as const, error: "비밀번호가 일치하지 않습니다." };
    return {
      ok: true as const,
      reservation: {
        id: row.id,
        date: row.date,
        dept: row.dept,
        name: row.reserver_name,
        ext: row.ext,
      },
    };
  });

export const updateReservationHours = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), pw: pw4, hours: hoursSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { verifyPassword, insertHours } = await import("./reservations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("reservations")
      .select("id, date, pw_hash")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "예약을 찾을 수 없습니다." };
    if (!verifyPassword(data.pw, row.pw_hash))
      return { ok: false as const, error: "비밀번호가 일치하지 않습니다." };

    const { data: oldHours } = await supabaseAdmin
      .from("reservation_hours")
      .select("hour")
      .eq("reservation_id", row.id);
    const previous = (oldHours ?? []).map((h) => h.hour);

    await supabaseAdmin
      .from("reservation_hours")
      .delete()
      .eq("reservation_id", row.id);

    const next = Array.from(new Set(data.hours)).sort((a, b) => a - b);
    const { error: hErr } = await insertHours(row.id, row.date, next);
    if (hErr) {
      if (previous.length) await insertHours(row.id, row.date, previous);
      return {
        ok: false as const,
        error: "선택한 시간에 이미 다른 예약이 있습니다. 다시 확인해 주세요.",
      };
    }
    await supabaseAdmin
      .from("reservations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true as const };
  });

export const cancelReservation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), pw: pw4 }).parse(input),
  )
  .handler(async ({ data }) => {
    const { verifyPassword } = await import("./reservations.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("reservations")
      .select("id, pw_hash")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "예약을 찾을 수 없습니다." };
    if (!verifyPassword(data.pw, row.pw_hash))
      return { ok: false as const, error: "비밀번호가 일치하지 않습니다." };
    await supabaseAdmin.from("reservations").delete().eq("id", row.id);
    return { ok: true as const };
  });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ password: z.string().min(1).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { checkAdminPassword, setAdminSession } = await import(
      "./reservations.server"
    );
    if (!checkAdminPassword(data.password)) {
      await new Promise((r) => setTimeout(r, 400));
      return { ok: false as const, error: "관리자 비밀번호가 아닙니다." };
    }
    await setAdminSession(true);
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { setAdminSession } = await import("./reservations.server");
  await setAdminSession(false);
  return { ok: true as const };
});

export const adminListReservations = createServerFn({ method: "GET" }).handler(
  async () => {
    const { isAdmin } = await import("./reservations.server");
    if (!(await isAdmin())) return { authed: false as const, rows: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reservations")
      .select("id, date, dept, reserver_name, ext")
      .order("date", { ascending: true });
    const { data: hours } = await supabaseAdmin
      .from("reservation_hours")
      .select("reservation_id, hour");
    const byId = new Map<string, number[]>();
    (hours ?? []).forEach((h) => {
      const list = byId.get(h.reservation_id) ?? [];
      list.push(h.hour);
      byId.set(h.reservation_id, list);
    });
    return {
      authed: true as const,
      rows: (rows ?? []).map((r) => ({
        id: r.id,
        date: r.date,
        dept: r.dept,
        name: r.reserver_name,
        ext: r.ext,
        hours: (byId.get(r.id) ?? []).sort((a, b) => a - b),
      })),
    };
  },
);

export const adminDeleteReservation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { isAdmin } = await import("./reservations.server");
    if (!(await isAdmin()))
      return { ok: false as const, error: "관리자 인증이 필요합니다." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("reservations").delete().eq("id", data.id);
    return { ok: true as const };
  });
