import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import symbolAsset from "@/assets/seongnam-symbol.png.asset.json";
import step1Asset from "@/assets/help-step1.png.asset.json";
import step2Asset from "@/assets/help-step2.png.asset.json";
import step3Asset from "@/assets/help-step3.png.asset.json";
import step4Asset from "@/assets/help-step4.png.asset.json";
import { DOW, HOURS, keyOf, pad, parseKey, rangeLabel } from "@/lib/booking-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  adminDeleteReservation,
  adminListReservations,
  adminLogin,
  cancelReservation,
  createReservation,
  listReservations,
  updateReservationHours,
  verifyReservation,
} from "@/lib/reservations.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "드론관제실 대관 시스템 | 성남시 AI반도체과" },
      {
        name: "description",
        content:
          "성남시 드론관제실 회의실 예약 시스템. 날짜와 시간을 선택해 예약하고, 비밀번호로 예약을 수정하거나 취소할 수 있습니다.",
      },
      { property: "og:title", content: "드론관제실 대관 시스템" },
      {
        property: "og:description",
        content: "드론관제실 회의실을 1시간 단위로 예약하고 관리하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ROOM_NAME = "드론관제실";

type Reservation = {
  id: string;
  date: string;
  dept: string;
  ext: string;
  hours: number[];
};

type DetailState = { id: string; hour: number } | null;

function Index() {
  const fetchList = useServerFn(listReservations);
  const create = useServerFn(createReservation);
  const verify = useServerFn(verifyReservation);
  const updateHours = useServerFn(updateReservationHours);
  const cancel = useServerFn(cancelReservation);
  const login = useServerFn(adminLogin);
  const adminList = useServerFn(adminListReservations);
  const adminDelete = useServerFn(adminDeleteReservation);

  const now = new Date();
  const todayKey = keyOf(new Date());
  const isMobile = useIsMobile();

  const [screen, setScreen] = useState<"calendar" | "reserve" | "admin">("calendar");
  const [view, setView] = useState<"month" | "week">("month");
  const [cursorKey, setCursorKey] = useState(
    keyOf(new Date(now.getFullYear(), now.getMonth(), 1)),
  );
  const [weekAnchor, setWeekAnchor] = useState(todayKey);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [sel, setSel] = useState<number[]>([]);
  const [editing, setEditing] = useState<{ id: string; pw: string } | null>(null);
  const [dept, setDept] = useState("");
  const [name, setName] = useState("");
  const [ext, setExt] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState<DetailState>(null);
  const [detailPw, setDetailPw] = useState("");
  const [detailErr, setDetailErr] = useState("");
  const [detailUnlocked, setDetailUnlocked] = useState<{
    name: string;
    ext: string;
    dept: string;
    pw: string;
  } | null>(null);

  const [adminPw, setAdminPw] = useState("");
  const [adminErr, setAdminErr] = useState("");
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const [adminTab, setAdminTab] = useState<"upcoming" | "past">("upcoming");
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const isPastHour = useCallback(
    (dateKey: string, hour: number) => {
      const d = parseKey(dateKey);
      d.setHours(hour + 1, 0, 0, 0);
      return d.getTime() <= nowTick;
    },
    [nowTick],
  );
  const isPastReservation = useCallback(
    (r: { date: string; hours: number[] }) =>
      r.hours.length > 0 && r.hours.every((h) => isPastHour(r.date, h)),
    [isPastHour],
  );


  const listQuery = useQuery({
    queryKey: ["reservations"],
    queryFn: async () => (await fetchList()).reservations as Reservation[],
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
  });
  const reservations = useMemo(
    () => listQuery.data ?? [],
    [listQuery.data],
  );

  const adminQuery = useQuery({
    queryKey: ["admin-reservations"],
    queryFn: () => adminList(),
    enabled: screen === "admin",
    refetchInterval: screen === "admin" ? 8000 : false,
  });
  const adminAuthed = adminQuery.data?.authed === true;
  const adminRows = adminQuery.data?.rows ?? [];

  const byDate = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    reservations.forEach((r) => {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    });
    return map;
  }, [reservations]);

  const dayReservations = useCallback(
    (k: string) => byDate.get(k) ?? [],
    [byDate],
  );

  const findByHour = useCallback(
    (k: string, hour: number) =>
      dayReservations(k).find((r) => r.hours.includes(hour)) ?? null,
    [dayReservations],
  );

  const refresh = () => {
    listQuery.refetch();
    if (screen === "admin") adminQuery.refetch();
  };

  const openDate = (k: string, hour?: number) => {
    setScreen("reserve");
    setSelectedDate(k);
    setError("");
    setEditing(null);
    setDept("");
    setName("");
    setExt("");
    setPw("");
    setSel(hour != null && !findByHour(k, hour) ? [hour] : []);
  };

  const openDetail = (id: string, hour: number) => {
    setDetail({ id, hour });
    setDetailPw("");
    setDetailErr("");
    setDetailUnlocked(null);
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailPw("");
    setDetailErr("");
    setDetailUnlocked(null);
  };

  // ---- month grid
  const cursor = parseKey(cursorKey);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - first.getDay());
  const cells: Array<{
    key: string;
    dayLabel: string;
    isToday: boolean;
    chips: Array<{ dept: string; range: string }>;
    hasMore: boolean;
    moreLabel: string;
    bg: string;
    numColor: string;
    cursor: string;
    inMonth: boolean;
  }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    if (i >= 35 && d.getMonth() !== cursor.getMonth()) break;
    const k = keyOf(d);
    const inMonth = d.getMonth() === cursor.getMonth();
    const groups = dayReservations(k);
    cells.push({
      key: `${k}-${i}`,
      dayLabel: String(d.getDate()),
      isToday: k === todayKey && inMonth,
      chips: groups.slice(0, 3).map((g) => ({
        dept: `${g.dept} (${g.ext})`,
        range: rangeLabel(g.hours),
      })),
      hasMore: groups.length > 3,
      moreLabel: `+${groups.length - 3}건 더`,
      bg: inMonth ? (k === todayKey ? "#faf6fb" : "#ffffff") : "#fbfafb",
      numColor: inMonth ? "#1d1d1d" : "#c9c6cb",
      cursor: inMonth ? "pointer" : "default",
      inMonth,
    });
  }
  const monthCellDates = cells.map((c) => c.key.slice(0, 10));

  // ---- week grid
  const ws = parseKey(weekAnchor);
  ws.setDate(ws.getDate() - ws.getDay());
  const weekDayDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    weekDayDates.push(d);
  }
  const lastWeekDay = weekDayDates[6] as Date;

  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  const weekLabel = `${ws.getMonth() + 1}월 ${ws.getDate()}일 – ${lastWeekDay.getMonth() + 1}월 ${lastWeekDay.getDate()}일`;
  const isMonthView = view === "month";

  // ---- reserve screen
  const selDate = parseKey(selectedDate);
  const dayList = dayReservations(selectedDate).filter(
    (r) => !editing || r.id !== editing.id,
  );
  const usedHourCount = dayList.reduce((n, r) => n + r.hours.length, 0);

  const detailReservation = detail
    ? reservations.find((r) => r.id === detail.id) ?? null
    : null;

  const submit = async () => {
    if (!sel.length) return setError("시간을 한 개 이상 선택해 주세요.");
    if (!editing) {
      if (!dept.trim()) return setError("팀을 입력해 주세요.");
      if (!name.trim()) return setError("예약자 이름을 입력해 주세요.");
      if (!/^\d{4}$/.test(ext)) return setError("내선 뒷 4자리를 숫자로 입력해 주세요.");
      if (!/^\d{4}$/.test(pw)) return setError("비밀번호 4자리를 숫자로 입력해 주세요.");
    }
    setSubmitting(true);
    try {
      const res = editing
        ? await updateHours({ data: { id: editing.id, pw: editing.pw, hours: sel } })
        : await create({
            data: {
              date: selectedDate,
              hours: sel,
              dept: dept.trim(),
              name: name.trim(),
              ext,
              pw,
            },
          });
      if (!res.ok) {
        setError(res.error);
        await listQuery.refetch();
        return;
      }
      const label = rangeLabel(sel);
      const wasEditing = !!editing;
      setSel([]);
      setDept("");
      setName("");
      setExt("");
      setPw("");
      setError("");
      setEditing(null);
      setScreen("calendar");
      await listQuery.refetch();
      flash(
        wasEditing
          ? `${label}로 변경했습니다.`
          : `${label} 예약이 완료되었습니다.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const doVerify = async () => {
    if (!detail) return;
    if (!/^\d{4}$/.test(detailPw))
      return setDetailErr("비밀번호 4자리를 숫자로 입력해 주세요.");
    const res = await verify({ data: { id: detail.id, pw: detailPw } });
    if (!res.ok) return setDetailErr(res.error);
    setDetailUnlocked({
      name: res.reservation.name,
      ext: res.reservation.ext,
      dept: res.reservation.dept,
      pw: detailPw,
    });
    setDetailErr("");
  };

  const startEdit = () => {
    if (!detailUnlocked || !detailReservation) return;
    setScreen("reserve");
    setSelectedDate(detailReservation.date);
    setEditing({ id: detailReservation.id, pw: detailUnlocked.pw });
    setSel(detailReservation.hours.slice());
    setDept(detailUnlocked.dept);
    setName(detailUnlocked.name);
    setExt(detailUnlocked.ext);
    setPw(detailUnlocked.pw);
    setError("");
    closeDetail();
  };

  const doCancel = async () => {
    if (!detailUnlocked || !detailReservation) {
      setDetailErr("먼저 비밀번호를 확인해 주세요.");
      return;
    }
    const count = detailReservation.hours.length;
    const res = await cancel({
      data: { id: detailReservation.id, pw: detailUnlocked.pw },
    });
    if (!res.ok) return setDetailErr(res.error);
    closeDetail();
    await listQuery.refetch();
    flash(`예약 ${count}시간을 모두 취소했습니다.`);
  };

  const doAdminLogin = async () => {
    const pw = adminPw.trim();
    if (!pw) {
      setAdminErr("관리자 비밀번호를 입력해 주세요.");
      return;
    }
    const res = await login({ data: { password: pw } });
    if (!res.ok) {
      setAdminErr(res.error);
      return;
    }
    setAdminErr("");
    setAdminPw("");
    await adminQuery.refetch();
  };

  const statDepts = new Set(adminRows.map((r) => r.dept)).size;
  const adminPastRows = adminRows.filter((r) => isPastReservation(r));
  const adminUpcomingRows = adminRows.filter((r) => !isPastReservation(r));
  const statUpcoming = adminUpcomingRows.length;
  const visibleAdminRows = adminTab === "past" ? adminPastRows : adminUpcomingRows;


  const helpSteps = [
    {
      n: "1",
      title: "달력에서 예약이 있는 날짜를 클릭합니다",
      desc: "날짜칸에 부서명과 시간이 표시됩니다.",
      height: 190,
      src: step1Asset.url,
      alt: "스크린샷: 달력에서 날짜 클릭",
    },
    {
      n: "2",
      title: "보라색으로 채워진 예약 블록을 클릭합니다",
      desc: "예약된 시간에는 부서명이 표시되며, 누르면 예약 상세 창이 열립니다.",
      height: 300,
      src: step2Asset.url,
      alt: "스크린샷: 예약된 블록 클릭",
    },
    {
      n: "3",
      title: "비밀번호 4자리를 입력하고 확인합니다",
      desc: "예약할 때 정한 비밀번호입니다. 확인 전에는 변경·취소 버튼이 나타나지 않습니다.",
      height: 330,
      src: step3Asset.url,
      alt: "스크린샷: 비밀번호 확인 창",
    },
    {
      n: "4",
      title: "시간 변경 또는 예약 전체 취소를 선택합니다",
      desc: "시간 변경은 기존 시간이 선택된 상태로 예약 화면을 열어 주고, 예약 전체 취소는 해당 예약의 모든 시간을 한 번에 없앱니다.",
      height: 310,
      src: step4Asset.url,
      alt: "스크린샷: 시간 변경 / 예약 전체 취소",
    },
  ];

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#1d1d1d",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isMobile ? 10 : 24,
          padding: isMobile ? "12px 14px" : "16px 24px",
          background: "#ffffff",
          borderBottom: "1px solid #e6e6e6",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setScreen("calendar");
            setHelp(false);
            closeDetail();
          }}
          title="메인 화면으로"
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 12,
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          <img
            src={symbolAsset.url}
            alt="성남시"
            style={{
              height: isMobile ? 28 : 38,
              width: "auto",
              display: "block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: isMobile ? 16 : 20,
              fontWeight: 700,
              letterSpacing: "-0.2px",
              color: "#4a154b",
              whiteSpace: "nowrap",
            }}
          >
            {ROOM_NAME}
          </span>
          {!isMobile && (
            <span
              style={{
                fontSize: 14,
                lineHeight: 1.43,
                letterSpacing: "0.1px",
                color: "#696969",
              }}
            >
              회의실 대관
            </span>
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => {
              setScreen("admin");
              setAdminErr("");
            }}
            style={{
              border: "none",
              cursor: "pointer",
              background: "#4a154b",
              color: "#ffffff",
              fontSize: isMobile ? 13 : 14.4,
              fontWeight: 700,
              letterSpacing: "0.144px",
              padding: isMobile ? "8px 16px" : "10px 24px",
              borderRadius: 90,
            }}
          >
            관리자
          </button>
        </div>
      </div>

      {screen === "calendar" && (
        <div style={{ position: "relative", flex: 1 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              height: 380,
              background:
                "radial-gradient(60% 80% at 12% 0%, #ffeadd 0%, rgba(255,234,221,0) 70%), radial-gradient(50% 90% at 78% 6%, #ece0ff 0%, rgba(236,224,255,0) 72%), radial-gradient(45% 70% at 45% 30%, #e6f0e4 0%, rgba(230,240,228,0) 75%), linear-gradient(#f4ede4, #ffffff)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              maxWidth: 1240,
              margin: "0 auto",
              padding: isMobile ? "28px 14px 64px" : "56px 24px 96px",
            }}
          >
            <h1
              style={{
                margin: 0,
                textAlign: "center",
                fontFamily: "'Nanum Myeongjo', serif",
                fontSize: isMobile ? 30 : 58,
                fontWeight: 800,
                lineHeight: 1.16,
                letterSpacing: isMobile ? "-0.8px" : "-1.6px",
                color: "#4a154b",
              }}
            >
              드론관제실 대관 시스템
            </h1>
            <p
              style={{
                margin: isMobile ? "10px 0 0" : "14px 0 0",
                textAlign: "center",
                fontSize: isMobile ? 14 : 18,
                lineHeight: 1.55,
                letterSpacing: "-0.0216px",
                color: "#696969",
              }}
            >
              예약을 원하는 날짜를 선택하여 예약을 진행해주세요
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                marginTop: 36,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={() =>
                    isMonthView
                      ? setCursorKey(
                          keyOf(
                            new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                          ),
                        )
                      : setWeekAnchor(
                          keyOf(
                            new Date(
                              ws.getFullYear(),
                              ws.getMonth(),
                              ws.getDate() - 7,
                            ),
                          ),
                        )
                  }
                  style={{
                    cursor: "pointer",
                    width: 40,
                    height: 40,
                    borderRadius: 90,
                    border: "1px solid #e6e6e6",
                    background: "#ffffff",
                    color: "#1d1d1d",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  ‹
                </button>
                <div
                  style={{
                    minWidth: 200,
                    textAlign: "center",
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 1.33,
                    letterSpacing: "-0.096px",
                  }}
                >
                  {isMonthView ? monthLabel : weekLabel}
                </div>
                <button
                  onClick={() =>
                    isMonthView
                      ? setCursorKey(
                          keyOf(
                            new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                          ),
                        )
                      : setWeekAnchor(
                          keyOf(
                            new Date(
                              ws.getFullYear(),
                              ws.getMonth(),
                              ws.getDate() + 7,
                            ),
                          ),
                        )
                  }
                  style={{
                    cursor: "pointer",
                    width: 40,
                    height: 40,
                    borderRadius: 90,
                    border: "1px solid #e6e6e6",
                    background: "#ffffff",
                    color: "#1d1d1d",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  ›
                </button>
              </div>
              <button
                onClick={() => setHelp(true)}
                style={{
                  cursor: "pointer",
                  border: "2px solid #4a154b",
                  background: "#ffffff",
                  color: "#4a154b",
                  fontSize: 14.4,
                  fontWeight: 700,
                  letterSpacing: "0.144px",
                  padding: "8px 24px",
                  borderRadius: 90,
                }}
              >
                예약·취소 방법 안내
              </button>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  padding: 4,
                  background: "#f9f0ff",
                  borderRadius: 90,
                }}
              >
                <button
                  onClick={() => setView("month")}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    padding: "9px 26px",
                    borderRadius: 90,
                    fontSize: 14.4,
                    fontWeight: 700,
                    letterSpacing: "0.144px",
                    background: isMonthView ? "#4a154b" : "transparent",
                    color: isMonthView ? "#ffffff" : "#1d1d1d",
                  }}
                >
                  월간
                </button>
                <button
                  onClick={() => setView("week")}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    padding: "9px 26px",
                    borderRadius: 90,
                    fontSize: 14.4,
                    fontWeight: 700,
                    letterSpacing: "0.144px",
                    background: isMonthView ? "transparent" : "#4a154b",
                    color: isMonthView ? "#1d1d1d" : "#ffffff",
                  }}
                >
                  주간
                </button>
              </div>
            </div>

            {isMonthView && (
              <div
                style={{
                  marginTop: 20,
                  background: "#ffffff",
                  border: "1px solid #e6e6e6",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "rgba(0,0,0,0.1) 0 0 32px 0",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    borderBottom: "1px solid #e6e6e6",
                  }}
                >
                  {DOW.map((d) => (
                    <div
                      key={d}
                      style={{
                        padding: "14px 16px",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.96px",
                        color: "#696969",
                      }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div
                  style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
                >
                  {cells.map((c, i) => (
                    <div
                      key={c.key}
                      onClick={
                        c.inMonth
                          ? () => openDate(monthCellDates[i] as string)
                          : undefined
                      }
                      style={{
                        minHeight: 122,
                        padding: 12,
                        borderRight: "1px solid #f0eef1",
                        borderBottom: "1px solid #f0eef1",
                        background: c.bg,
                        cursor: c.cursor,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{ fontSize: 16, fontWeight: 700, color: c.numColor }}
                        >
                          {c.dayLabel}
                        </span>
                        {c.isToday && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              letterSpacing: "0.96px",
                              color: "#ffffff",
                              background: "#4a154b",
                              padding: "2px 8px",
                              borderRadius: 90,
                            }}
                          >
                            오늘
                          </span>
                        )}
                      </div>
                      <div
                        style={{ display: "flex", flexDirection: "column", gap: 4 }}
                      >
                        {c.chips.map((chip, ci) => (
                          <div
                            key={ci}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                              background: "#f9f0ff",
                              borderRadius: 4,
                              padding: "4px 7px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#4a154b",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {chip.dept}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#696969",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {chip.range}
                            </span>
                          </div>
                        ))}
                        {c.hasMore && (
                          <span
                            style={{
                              fontSize: 12,
                              color: "#696969",
                              paddingLeft: 2,
                            }}
                          >
                            {c.moreLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isMonthView && (
              <div
                style={{
                  marginTop: 20,
                  background: "#ffffff",
                  border: "1px solid #e6e6e6",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "rgba(0,0,0,0.1) 0 0 32px 0",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "124px repeat(7, 1fr)",
                    borderBottom: "1px solid #e6e6e6",
                    position: "sticky",
                    top: 0,
                    background: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.96px",
                      color: "#696969",
                    }}
                  >
                    시간
                  </div>
                  {weekDayDates.map((d) => {
                    const k = keyOf(d);
                    return (
                      <div
                        key={k}
                        onClick={() => openDate(k)}
                        style={{
                          padding: "12px 10px",
                          cursor: "pointer",
                          background: k === todayKey ? "#faf6fb" : "#ffffff",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: "0.96px",
                            color: "#696969",
                          }}
                        >
                          {DOW[d.getDay()]}
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            letterSpacing: "-0.0216px",
                            color: k === todayKey ? "#4a154b" : "#1d1d1d",
                          }}
                        >
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ maxHeight: 620, overflowY: "auto" }}>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "124px repeat(7, 1fr)",
                        borderBottom: "1px solid #f4f2f5",
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 10px",
                          fontSize: 12,
                          color: "#696969",
                          borderRight: "1px solid #f0eef1",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {`${pad(h)}:00 – ${pad(h + 1)}:00`}
                      </div>
                      {weekDayDates.map((d) => {
                        const k = keyOf(d);
                        const b = findByHour(k, h);
                        return (
                          <div
                            key={`${k}-${h}`}
                            onClick={() =>
                              b ? openDetail(b.id, h) : openDate(k, h)
                            }
                            style={{
                              height: 34,
                              borderRight: "1px solid #f4f2f5",
                              padding: "3px 4px",
                              cursor: "pointer",
                              background: b ? "#4a154b" : "#ffffff",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#ffffff",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {b ? b.dept : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: "#4a154b",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{ fontSize: 14, color: "#696969", letterSpacing: "0.1px" }}
                >
                  예약됨
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: "#ffffff",
                    border: "1px solid #e6e6e6",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{ fontSize: 14, color: "#696969", letterSpacing: "0.1px" }}
                >
                  예약 가능
                </span>
              </div>
              <div
                style={{ fontSize: 14, color: "#696969", letterSpacing: "0.1px" }}
              >
                날짜를 클릭하면 예약 화면으로 이동합니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "reserve" && (
        <div style={{ flex: 1, background: "#ffffff" }}>
          <div
            style={{
              maxWidth: 1240,
              margin: "0 auto",
              padding: "40px 24px 96px",
            }}
          >
            <button
              onClick={() => {
                setScreen("calendar");
                setError("");
              }}
              style={{
                cursor: "pointer",
                border: "none",
                background: "transparent",
                color: "#1264a3",
                fontSize: 16,
                fontWeight: 700,
                padding: 0,
                marginBottom: 20,
              }}
            >
              ← 달력으로 돌아가기
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 32,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  letterSpacing: "-0.256px",
                }}
              >
                {`${selDate.getFullYear()}년 ${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${DOW[selDate.getDay()]})`}
              </h2>
              <span style={{ fontSize: 16, color: "#696969" }}>
                {dayList.length
                  ? `예약 ${dayList.length}건 · 남은 시간 ${17 - usedHourCount}개`
                  : "아직 예약이 없습니다"}
              </span>
            </div>
            {editing && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  marginTop: 16,
                  background: "#f9f0ff",
                  borderRadius: 12,
                  padding: "14px 20px",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.1px",
                    color: "#4a154b",
                  }}
                >
                  예약 수정 중 — 시간을 다시 선택하면 기존 예약 전체가 새 시간으로
                  바뀝니다.
                </span>
                <button
                  onClick={() => {
                    setScreen("calendar");
                    setEditing(null);
                    setSel([]);
                    setDept("");
                    setName("");
                    setExt("");
                    setPw("");
                    setError("");
                  }}
                  style={{
                    marginLeft: "auto",
                    cursor: "pointer",
                    border: "none",
                    background: "transparent",
                    color: "#1264a3",
                    fontSize: 14,
                    fontWeight: 700,
                    padding: 0,
                  }}
                >
                  수정 그만하기
                </button>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)",
                gap: 32,
                alignItems: "start",
                marginTop: 28,
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e6e6e6",
                  borderRadius: 16,
                  padding: 32,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      lineHeight: 1.56,
                      letterSpacing: "-0.0216px",
                    }}
                  >
                    시간 선택{" "}
                    <span style={{ color: "#696969", fontWeight: 400 }}>
                      1시간 단위 · 여러 블록 선택 가능
                    </span>
                  </h3>
                  <span
                    style={{ fontSize: 14, color: "#696969", letterSpacing: "0.1px" }}
                  >
                    {sel.length
                      ? `선택 ${sel.length}시간 · ${rangeLabel(sel)}`
                      : "선택된 시간 없음"}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                    marginTop: 20,
                  }}
                >
                  {HOURS.map((h) => {
                    const b = dayList.find((r) => r.hours.includes(h)) ?? null;
                    const picked = sel.includes(h);
                    const past = isPastHour(selectedDate, h);
                    return (
                      <button
                        key={h}
                        disabled={past && !b}
                        onClick={() =>
                          b
                            ? openDetail(b.id, h)
                            : past
                              ? undefined
                              : (setError(""),
                                setSel((prev) =>
                                  prev.includes(h)
                                    ? prev.filter((x) => x !== h)
                                    : prev.concat(h),
                                ))
                        }
                        style={{
                          textAlign: "left",
                          cursor: past && !b ? "not-allowed" : "pointer",
                          border: `1px solid ${b ? "#4a154b" : picked ? "#4a154b" : "#e6e6e6"}`,
                          background: b
                            ? past
                              ? "#8d7b8e"
                              : "#4a154b"
                            : picked
                              ? "#f9f0ff"
                              : past
                                ? "#f3f2f4"
                                : "#ffffff",
                          color: b ? "#ffffff" : picked ? "#4a154b" : past ? "#b3b0b5" : "#696969",
                          borderRadius: 8,
                          padding: "12px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          minHeight: 68,
                        }}
                      >
                        <span style={{ fontSize: 16, fontWeight: 700 }}>
                          {`${pad(h)}:00 – ${pad(h + 1)}:00`}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            opacity: 0.85,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "100%",
                          }}
                        >
                          {b
                            ? `${b.dept}${past ? " · 지난 예약" : ""}`
                            : picked
                              ? "선택됨"
                              : past
                                ? "지난 시간"
                                : "예약 가능"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 14,
                    color: "#696969",
                    letterSpacing: "0.1px",
                  }}
                >
                  이미 예약된 시간은 선택할 수 없고, 예약한 팀만 표시됩니다. 예약된
                  블록을 누르면 상세 정보에서 수정·취소할 수 있습니다.
                </div>
              </div>

              <div
                style={{
                  background: "#f4ede4",
                  borderRadius: 16,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 1.33,
                    letterSpacing: "-0.096px",
                  }}
                >
                  예약자 정보
                </h3>
                <label
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1px" }}
                  >
                    팀
                  </span>
                  <input
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    placeholder="예: 반도체팀"
                    maxLength={20}
                    disabled={!!editing}
                    style={{
                      border: "1px solid #e6e6e6",
                      borderRadius: 4,
                      padding: "11px 12px",
                      fontSize: 16,
                      background: "#ffffff",
                      color: "#1d1d1d",
                    }}
                  />
                </label>
                <label
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1px" }}
                  >
                    예약자 이름
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    maxLength={20}
                    disabled={!!editing}
                    style={{
                      border: "1px solid #e6e6e6",
                      borderRadius: 4,
                      padding: "11px 12px",
                      fontSize: 16,
                      background: "#ffffff",
                      color: "#1d1d1d",
                    }}
                  />
                </label>
                <label
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1px" }}
                  >
                    내선 뒷 4자리
                  </span>
                  <input
                    value={ext}
                    onChange={(e) =>
                      setExt(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    inputMode="numeric"
                    placeholder="1234"
                    maxLength={4}
                    disabled={!!editing}
                    style={{
                      border: "1px solid #e6e6e6",
                      borderRadius: 4,
                      padding: "11px 12px",
                      fontSize: 16,
                      letterSpacing: 4,
                      background: "#ffffff",
                      color: "#1d1d1d",
                    }}
                  />
                </label>
                <label
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1px" }}
                  >
                    비밀번호 4자리
                  </span>
                  <input
                    value={pw}
                    onChange={(e) =>
                      setPw(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    maxLength={4}
                    disabled={!!editing}
                    style={{
                      border: "1px solid #e6e6e6",
                      borderRadius: 4,
                      padding: "11px 12px",
                      fontSize: 16,
                      letterSpacing: 4,
                      background: "#ffffff",
                      color: "#1d1d1d",
                    }}
                  />
                </label>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.43,
                    color: "#696969",
                    letterSpacing: "0.1px",
                  }}
                >
                  비밀번호는 예약 수정·취소에 사용됩니다. 잊지 마세요.
                </div>
                {!!error && (
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#cc4117",
                      letterSpacing: "0.1px",
                    }}
                  >
                    {error}
                  </div>
                )}
                <button
                  onClick={submit}
                  disabled={submitting}
                  style={{
                    cursor: submitting ? "progress" : "pointer",
                    border: "none",
                    background: "#4a154b",
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                    padding: "14px 28px",
                    borderRadius: 90,
                    marginTop: 4,
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {editing ? "변경 저장" : "예약하기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "admin" && (
        <div style={{ flex: 1, background: "#ffffff" }}>
          <div
            style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 24px 96px" }}
          >
            <button
              onClick={() => setScreen("calendar")}
              style={{
                cursor: "pointer",
                border: "none",
                background: "transparent",
                color: "#1264a3",
                fontSize: 16,
                fontWeight: 700,
                padding: 0,
                marginBottom: 20,
              }}
            >
              ← 달력으로 돌아가기
            </button>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.96px",
                textTransform: "uppercase",
                color: "#696969",
              }}
            >
              관리자
            </div>
            <h2
              style={{
                margin: "10px 0 24px",
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.256px",
              }}
            >
              전체 예약 관리
            </h2>

            {!adminAuthed && (
              <div
                style={{
                  maxWidth: 420,
                  background: "#f9f0ff",
                  borderRadius: 16,
                  padding: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1px" }}
                >
                  관리자 비밀번호
                </span>
                <input
                  value={adminPw}
                  onChange={(e) =>
                    setAdminPw(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="••••"
                  style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 4,
                    padding: "11px 12px",
                    fontSize: 16,
                    letterSpacing: 4,
                    background: "#ffffff",
                  }}
                />
                {!!adminErr && (
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#cc4117" }}
                  >
                    {adminErr}
                  </div>
                )}
                <button
                  onClick={doAdminLogin}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    background: "#4a154b",
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                    padding: "14px 28px",
                    borderRadius: 90,
                  }}
                >
                  확인
                </button>
              </div>
            )}

            {adminAuthed && (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 24,
                  }}
                >
                  {[
                    { v: adminRows.length, l: "등록된 예약 건수" },
                    { v: statDepts, l: "이용 팀 수" },
                    { v: statUpcoming, l: "진행·예정 예약" },
                    { v: adminPastRows.length, l: "과거 내역" },

                  ].map((s) => (
                    <div
                      key={s.l}
                      style={{
                        flex: 1,
                        minWidth: 200,
                        background: "#ffffff",
                        border: "1px solid #e6e6e6",
                        borderRadius: 16,
                        padding: 24,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 50,
                          fontWeight: 700,
                          lineHeight: 1.12,
                          letterSpacing: "-0.6px",
                          color: "#4a154b",
                        }}
                      >
                        {s.v}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "#696969",
                          letterSpacing: "0.1px",
                        }}
                      >
                        {s.l}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([
                    { k: "upcoming" as const, l: `진행·예정 (${adminUpcomingRows.length})` },
                    { k: "past" as const, l: `과거 내역 (${adminPastRows.length})` },
                  ]).map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setAdminTab(t.k)}
                      style={{
                        cursor: "pointer",
                        border: `1px solid ${adminTab === t.k ? "#4a154b" : "#e6e6e6"}`,
                        background: adminTab === t.k ? "#4a154b" : "#ffffff",
                        color: adminTab === t.k ? "#ffffff" : "#696969",
                        fontSize: 14.4,
                        fontWeight: 700,
                        letterSpacing: "0.144px",
                        padding: "9px 20px",
                        borderRadius: 90,
                      }}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>


                <div
                  style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.1fr 0.7fr 1.1fr 0.9fr 0.7fr 90px",
                      gap: 12,
                      padding: "14px 20px",
                      background: "#f4ede4",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.96px",
                      color: "#696969",
                    }}
                  >
                    <div>날짜</div>
                    <div>시간</div>
                    <div>팀</div>
                    <div>예약자</div>
                    <div>내선</div>
                    <div />
                  </div>
                  {visibleAdminRows.map((r) => {
                    const d = parseKey(r.date);
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.1fr 0.7fr 1.1fr 0.9fr 0.7fr 90px",
                          gap: 12,
                          padding: "16px 20px",
                          borderTop: "1px solid #f0eef1",
                          alignItems: "center",
                          fontSize: 16,
                          background: adminTab === "past" ? "#fbfafb" : "#ffffff",
                          color: adminTab === "past" ? "#696969" : "inherit",
                        }}

                      >
                        <div>{`${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${DOW[d.getDay()]})`}</div>
                        <div style={{ fontWeight: 700 }}>{rangeLabel(r.hours)}</div>
                        <div>{r.dept}</div>
                        <div>{r.name}</div>
                        <div style={{ color: "#696969" }}>{r.ext}</div>
                        <button
                          onClick={async () => {
                            const res = await adminDelete({ data: { id: r.id } });
                            if (!res.ok) {
                              setAdminErr(res.error);
                              return;
                            }
                            await adminQuery.refetch();
                            await listQuery.refetch();
                            flash("예약을 삭제했습니다.");
                          }}
                          style={{
                            cursor: "pointer",
                            border: "2px solid #cc4117",
                            background: "#ffffff",
                            color: "#cc4117",
                            fontSize: 14.4,
                            fontWeight: 700,
                            letterSpacing: "0.144px",
                            padding: "7px 18px",
                            borderRadius: 90,
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    );
                  })}
                  {visibleAdminRows.length === 0 && (
                    <div
                      style={{
                        padding: "40px 20px",
                        textAlign: "center",
                        fontSize: 16,
                        color: "#696969",
                      }}
                    >
                      {adminTab === "past"
                        ? "과거 내역이 없습니다."
                        : "등록된 예약이 없습니다."}
                    </div>
                  )}

                </div>
              </>
            )}
          </div>
        </div>
      )}

      {detail && detailReservation && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(29,29,29,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 16,
              padding: isMobile ? 20 : 32,
              animation: "om-pop 0.18s ease-out",
              boxShadow: "rgba(0,0,0,0.2) 0 1px 10px 0",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.96px",
                textTransform: "uppercase",
                color: "#696969",
              }}
            >
              예약 상세
            </div>
            <h3
              style={{
                margin: "10px 0 20px",
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.33,
                letterSpacing: "-0.096px",
              }}
            >
              {`${parseKey(detailReservation.date).getMonth() + 1}월 ${parseKey(detailReservation.date).getDate()}일 ${pad(detail.hour)}:00-${pad(detail.hour + 1)}:00`}
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "#f9f0ff",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 16,
                }}
              >
                <span style={{ color: "#696969" }}>시간</span>
                <span style={{ fontWeight: 700 }}>
                  {rangeLabel(detailReservation.hours)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 16,
                }}
              >
                <span style={{ color: "#696969" }}>팀</span>
                <span style={{ fontWeight: 700 }}>{detailReservation.dept}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 16,
                }}
              >
                <span style={{ color: "#696969" }}>예약자</span>
                <span style={{ fontWeight: 700 }}>
                  {detailUnlocked ? detailUnlocked.name : "••••"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  fontSize: 16,
                }}
              >
                <span style={{ color: "#696969" }}>내선</span>
                <span style={{ fontWeight: 700 }}>{detailReservation.ext}</span>
              </div>
            </div>

            {!detailUnlocked && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.1px" }}
                >
                  수정·취소하려면 비밀번호 4자리를 입력하세요
                </span>
                <input
                  value={detailPw}
                  onChange={(e) =>
                    setDetailPw(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 4,
                    padding: "11px 12px",
                    fontSize: 16,
                    letterSpacing: 4,
                  }}
                />
                {!!detailErr && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#cc4117" }}>
                    {detailErr}
                  </div>
                )}
              </div>
            )}

            {detailUnlocked && (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 14,
                  lineHeight: 1.43,
                  color: "#696969",
                  letterSpacing: "0.1px",
                }}
              >
                이 예약({detailReservation.hours.length}시간)은 한 건으로 처리됩니다.
                취소하면 전체 시간이 함께 취소됩니다.
              </div>
            )}

            <div
              style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}
            >
              {!detailUnlocked && (
                <button
                  onClick={doVerify}
                  style={{
                    cursor: "pointer",
                    border: "none",
                    background: "#4a154b",
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                    padding: "14px 28px",
                    borderRadius: 90,
                  }}
                >
                  비밀번호 확인
                </button>
              )}
              {detailUnlocked && (
                <>
                  <button
                    onClick={startEdit}
                    style={{
                      cursor: "pointer",
                      border: "none",
                      background: "#4a154b",
                      color: "#ffffff",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.2px",
                      padding: "14px 28px",
                      borderRadius: 90,
                    }}
                  >
                    시간 변경
                  </button>
                  <button
                    onClick={doCancel}
                    style={{
                      cursor: "pointer",
                      border: "2px solid #cc4117",
                      background: "#ffffff",
                      color: "#cc4117",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.2px",
                      padding: "12px 26px",
                      borderRadius: 90,
                    }}
                  >
                    예약 전체 취소
                  </button>
                </>
              )}
              <button
                onClick={closeDetail}
                style={{
                  cursor: "pointer",
                  border: "none",
                  background: "#f9f0ff",
                  color: "#1d1d1d",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.2px",
                  padding: "14px 28px",
                  borderRadius: 90,
                  marginLeft: "auto",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {help && (
        <div
          onClick={() => setHelp(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(29,29,29,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 10 : 24,
            zIndex: 45,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: isMobile ? "92vh" : "84vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 16,
              padding: isMobile ? 18 : 32,
              animation: "om-pop 0.18s ease-out",
              boxShadow: "rgba(0,0,0,0.2) 0 1px 10px 0",
            }}
          >
            <h3
              style={{
                margin: isMobile ? "0 0 18px" : "0 0 24px",
                fontFamily: "'Nanum Myeongjo', serif",
                fontSize: isMobile ? 24 : 32,
                fontWeight: 800,
                lineHeight: 1.25,
                letterSpacing: "-1px",
                color: "#4a154b",
              }}
            >
              예약·취소 방법 안내
            </h3>

            {/* 섹션 1 : 예약 방법 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#f9f0ff",
                borderLeft: "6px solid #4a154b",
                borderRadius: 10,
                padding: isMobile ? "12px 14px" : "14px 18px",
              }}
            >
              <span
                style={{
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 800,
                  color: "#4a154b",
                  letterSpacing: "-0.4px",
                }}
              >
                예약 방법
              </span>
              <span
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: "#696969",
                  fontWeight: 700,
                }}
              >
                4단계
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                margin: isMobile ? "14px 0 28px" : "18px 0 36px",
              }}
            >
              {[
                {
                  n: "1",
                  t: "달력에서 원하는 날짜를 클릭합니다.",
                },
                {
                  n: "2",
                  t: "예약 화면에서 사용할 시간 블록을 선택합니다. 여러 블록을 함께 선택할 수 있고, 보라색으로 채워진 시간은 이미 예약된 시간입니다.",
                },
                {
                  n: "3",
                  t: "팀, 예약자 이름, 내선 뒷 4자리, 비밀번호 4자리를 입력합니다.",
                },
                {
                  n: "4",
                  t: "예약하기를 누르면 완료되며 달력에 팀명, 내선 번호, 시간이 표시됩니다.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${isMobile ? 28 : 32}px minmax(0, 1fr)`,
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: isMobile ? 28 : 32,
                      height: isMobile ? 28 : 32,
                      borderRadius: 90,
                      background: "#4a154b",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: isMobile ? 13 : 15,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? 14 : 16,
                      lineHeight: 1.55,
                      paddingTop: 3,
                    }}
                  >
                    {s.t}
                  </div>
                </div>
              ))}
            </div>

            {/* 섹션 2 : 예약 변경·취소 방법 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#f4ede4",
                borderLeft: "6px solid #cc4117",
                borderRadius: 10,
                padding: isMobile ? "12px 14px" : "14px 18px",
              }}
            >
              <span
                style={{
                  fontSize: isMobile ? 18 : 22,
                  fontWeight: 800,
                  color: "#cc4117",
                  letterSpacing: "-0.4px",
                }}
              >
                예약 변경·취소 방법
              </span>
              <span
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: "#696969",
                  fontWeight: 700,
                }}
              >
                4단계
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? 18 : 20,
                margin: isMobile ? "14px 0 24px" : "18px 0 28px",
              }}
            >
              {helpSteps.map((s) => (
                <div
                  key={s.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `${isMobile ? 28 : 40}px minmax(0, 1fr)`,
                    gap: isMobile ? 12 : 16,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: isMobile ? 28 : 40,
                      height: isMobile ? 28 : 40,
                      borderRadius: 90,
                      background: "#cc4117",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: isMobile ? 13 : 16,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.n}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    <div
                      style={{
                        fontSize: isMobile ? 14 : 16,
                        fontWeight: 700,
                        lineHeight: 1.5,
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: isMobile ? 13 : 14,
                        lineHeight: 1.55,
                        color: "#696969",
                      }}
                    >
                      {s.desc}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: isMobile ? Math.round(s.height * 0.62) : s.height,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid #e6e6e6",
                      }}
                    >
                      <img
                        src={s.src}
                        alt={s.alt}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#f4ede4",
                borderRadius: 12,
                padding: isMobile ? 16 : 20,
                fontSize: isMobile ? 13 : 14,
                lineHeight: 1.55,
                color: "#1d1d1d",
              }}
            >
              비밀번호를 잊은 경우에는 관리부서 AI반도체과로 문의해 주세요. 관리자
              화면에서 예약을 확인·삭제할 수 있습니다.
            </div>

            <div style={{ display: "flex", marginTop: 24 }}>
              <button
                onClick={() => setHelp(false)}
                style={{
                  marginLeft: "auto",
                  width: isMobile ? "100%" : "auto",
                  cursor: "pointer",
                  border: "none",
                  background: "#4a154b",
                  color: "#ffffff",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.2px",
                  padding: "14px 28px",
                  borderRadius: 90,
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {!!toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            background: "#4a154b",
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 700,
            padding: "14px 28px",
            borderRadius: 90,
            boxShadow: "rgba(0,0,0,0.2) 0 1px 10px 0",
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ background: "#4a154b", color: "#ffffff", padding: "32px 24px" }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>{ROOM_NAME} 대관 시스템</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.43,
                letterSpacing: "0.1px",
                color: "#d9bdde",
              }}
            >
              관리부서 AI반도체과 · 예약 비밀번호 분실 시 관리자 확인 필요
            </div>
            <div style={{ fontSize: 12, letterSpacing: "0.1px", color: "#a882b0" }}>
              제작: AI반도체과 사진우
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={refresh}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}
