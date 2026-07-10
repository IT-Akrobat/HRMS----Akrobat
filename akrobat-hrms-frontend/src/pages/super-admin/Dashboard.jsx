import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardList,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  Plus,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AttendanceTrendChart from "../../components/common/AttendanceTrendChart";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import DepartmentDistributionChart from "../../components/common/DepartmentDistributionChart";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";

// -----------------------------------------------------------------------
// A note on scope: the reference mockup (Server Status / Storage Usage /
// Backup Status / License Usage) is a generic admin-panel template — this
// codebase has no storage, backup, or license-management feature, so
// those cards would just be fake numbers. Everything below instead comes
// from real endpoints: GET /dashboard (company-wide counts — the same
// data HR Admin's dashboard uses, since Super Admin needs the full
// picture too), GET /audit-logs (recent activity), and GET
// /announcements/active. "System health"-style panels can be added for
// real once there's an actual metric backing them.
// -----------------------------------------------------------------------

// Mirrors distanceMeters/nearestLocationName in CheckInOutCard.jsx — used
// here to turn raw check-in lat/long from audit logs into a real location
// name instead of showing coordinates in Recent Activity.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveLocationName(lat, lon, locations) {
  if (lat == null || lon == null || !locations || locations.length === 0) {
    return null;
  }
  let best = null;
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
    if (!best || d < best.distance) best = { loc, distance: d };
  }
  return best ? best.loc.location_name : null;
}

// "Xh Ym" for a minutes count — mirrors formatDuration in CheckInOutCard.jsx,
// used to make check-out audit messages ("Checked out — 91 min worked...")
// read as "Checked out — 1h 31m worked..." in Recent Activity.
function formatMinutes(totalMinutes) {
  const total = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// audit_logs.description is a stringified JSON blob for system-generated
// entries (e.g. ATTENDANCE · CHECK_IN) but a plain string for others
// (e.g. AUTH · LOGIN: "Login: someone@akrobat.com"). This turns either
// shape into { name, action, time, lat, lon, kind } for display.
function parseLogEntry(log) {
  const employeeName = log.employees?.full_name || null;

  let details = null;
  if (typeof log.description === "string") {
    try {
      details = JSON.parse(log.description);
    } catch {
      details = null;
    }
  } else if (log.description && typeof log.description === "object") {
    details = log.description;
  }

  const changes = details?.changes || {};

  // Every field in `changes` comes from record_audit_log's diff (see
  // app/core/audit.py -> _diff), which stores {old, new} pairs, not the
  // raw value. Unwrap to .new here so downstream code (formatTime,
  // placeKey's lat.toFixed, etc.) always gets a plain string/number
  // instead of an object — that mismatch was the "lat.toFixed is not a
  // function" crash that took down the whole Recent Activity panel.
  function diffValue(v) {
    if (v && typeof v === "object" && "new" in v) return v.new;
    return v;
  }

  const name =
    employeeName ||
    diffValue(changes.employee_id) ||
    details?.target_employee_id ||
    "System";

  let action =
    details?.message ||
    (typeof log.description === "string" ? log.description : null) ||
    `${log.module} · ${log.action}`;

  // Backend writes check-out messages as "Checked out — 91 min worked,
  // status: Half Day" — swap the raw minute count for "1h 31m" so total
  // working hours read naturally in Recent Activity.
  const minutesMatch = action.match(/(\d+)\s*min worked/i);
  if (minutesMatch) {
    action = action.replace(
      /\d+\s*min worked/i,
      `${formatMinutes(Number(minutesMatch[1]))} worked`,
    );
  }

  const time =
    diffValue(changes.check_in_time) ||
    diffValue(changes.check_out_time) ||
    log.created_at ||
    null;

  const rawLat =
    diffValue(changes.check_in_latitude) ??
    diffValue(changes.check_out_latitude) ??
    null;
  const rawLon =
    diffValue(changes.check_in_longitude) ??
    diffValue(changes.check_out_longitude) ??
    null;

  // Coerce to real numbers — Supabase/Postgres numeric columns can come
  // back as strings, and placeKey/distanceMeters below need actual
  // numbers (lat.toFixed etc.), not strings or leftover diff objects.
  const lat = rawLat != null && rawLat !== "" ? Number(rawLat) : null;
  const lon = rawLon != null && rawLon !== "" ? Number(rawLon) : null;

  // What kind of entry this is, purely for choosing an icon/color.
  let kind = "other";
  const actionUpper = (log.action || "").toUpperCase();
  if (actionUpper.includes("CHECK_IN")) kind = "checkin";
  else if (actionUpper.includes("CHECK_OUT")) kind = "checkout";
  else if (actionUpper.includes("LOGIN")) kind = "login";
  else if (actionUpper.includes("LOGOUT")) kind = "logout";

  return { name, action, time, lat, lon, kind };
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// Colored-circle icon per activity type: check-in = light green,
// check-out = dark blue, login = blue, logout = orange.
function LogIcon({ kind }) {
  const map = {
    checkin: { Icon: LogIn, bg: "bg-emerald-100", fg: "text-emerald-500" },
    checkout: { Icon: LogOut, bg: "bg-[#0B1830]/10", fg: "text-[#0B1830]" },
    login: { Icon: LogIn, bg: "bg-blue-100", fg: "text-blue-500" },
    logout: { Icon: LogOut, bg: "bg-orange-100", fg: "text-orange-500" },
    other: { Icon: ShieldCheck, bg: "bg-slate-100", fg: "text-slate-400" },
  };
  const { Icon, bg, fg } = map[kind] || map.other;
  return (
    <div
      className={`w-8 h-8 rounded-full ${bg} ${fg} flex items-center justify-center shrink-0`}
    >
      <Icon size={14} />
    </div>
  );
}

// Quick Actions, shown as a row of small circular icon buttons next to the
// "System Dashboard" title (top-right of the page header) instead of the
// old full-width card at the bottom of the page.
const QUICK_ACTIONS = [
  { to: "/super-admin/users", label: "Add New User", icon: UserPlus },
  { to: "/super-admin/users/roles", label: "Manage Roles", icon: Settings2 },
  {
    to: "/super-admin/security/audit-logs",
    label: "View Audit Logs",
    icon: ClipboardList,
  },
  {
    to: "/super-admin/organization/departments",
    label: "Departments",
    icon: Building2,
  },
];

function QuickActionCircle({ to, label, icon: Icon }) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      className="group relative w-9 h-9 rounded-full bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
    >
      <Icon size={16} />
      {/* Tooltip on hover */}
      <span className="pointer-events-none absolute top-full mt-2 whitespace-nowrap rounded-md bg-slate-800 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {label}
      </span>
    </Link>
  );
}

// Rounds to ~100m precision so nearby check-ins/logouts from the same spot
// share one cache entry/lookup instead of firing a fresh reverse-geocode
// call for every single log row.
function placeKey(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const parts = [
      data.city || data.locality || data.principalSubdivision || null,
      data.principalSubdivision || null,
      data.countryName || null,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);

  const [announcements, setAnnouncements] = useState([]);

  const [trend, setTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);

  const [deptDistribution, setDeptDistribution] = useState([]);
  const [deptLoading, setDeptLoading] = useState(true);

  const [locations, setLocations] = useState([]);

  // Reverse-geocoded "City, State, Country" per unique check-in/out
  // coordinate in Recent Activity, keyed by placeKey(lat, lon) — see
  // reverseGeocode() above. Populated lazily once logs load.
  const [placeCache, setPlaceCache] = useState({});

  // Pulled out of the mount effect so it can also be called right after a
  // check-in/out/break action (via CheckInOutCard's onActivityChange) —
  // otherwise Recent Activity only ever reflected whatever was on the page
  // at initial load, so a fresh check-out wouldn't show up until a full
  // page refresh.
  function loadLogs() {
    setLogsLoading(true);
    setLogsError(null);
    return apiClient
      .get("/audit-logs/?page=1&limit=6")
      .then((res) => {
        const records = res.data?.records || [];
        setLogs(records);

        // Kick off reverse-geocoding for every unique coordinate pair in
        // this batch, once, rather than per-render.
        const uniqueCoords = new Map();
        for (const log of records) {
          const entry = parseLogEntry(log);
          if (entry.lat == null || entry.lon == null) continue;
          const key = placeKey(entry.lat, entry.lon);
          if (!key) continue;
          if (!uniqueCoords.has(key)) {
            uniqueCoords.set(key, { lat: entry.lat, lon: entry.lon });
          }
        }
        uniqueCoords.forEach(({ lat, lon }, key) => {
          reverseGeocode(lat, lon).then((label) => {
            if (label) {
              setPlaceCache((prev) => ({ ...prev, [key]: label }));
            }
          });
        });
      })
      .catch((err) => {
        // Previously this just set logs to [] — which looks IDENTICAL to
        // "there's genuinely no activity yet" in the UI, so a real 401 /
        // permission / network failure was invisible. Now the panel shows
        // the actual reason instead of a misleading empty state.
        setLogs([]);
        setLogsError(err.message || "Could not load recent activity.");
      })
      .finally(() => setLogsLoading(false));
  }

  useEffect(() => {
    // GET /dashboard is the one endpoint in this backend that returns its
    // model directly (no {success, data} envelope) — see app/dashboard/routes.py.
    apiClient
      .get("/dashboard/")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));

    loadLogs();

    apiClient
      .get("/announcements/active")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));

    apiClient
      .get("/dashboard/attendance-trend?days=7")
      .then((res) => setTrend(res))
      .catch(() => setTrend(null))
      .finally(() => setTrendLoading(false));

    apiClient
      .get("/dashboard/department-distribution")
      .then((res) => setDeptDistribution(res.departments || []))
      .catch(() => setDeptDistribution([]))
      .finally(() => setDeptLoading(false));

    // Needed to turn raw check-in coordinates in Recent Activity into a
    // location name instead of showing lat/long numbers.
    apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));
  }, []);

  return (
    <div>
      {/* Hides the scrollbar visually on the horizontal stat-card row and
          the recent-activity panel, while keeping them scrollable. */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <PageHeader
        title="System Dashboard"
        subtitle="Overview of your system and activity"
        actions={
          <div className="flex items-center gap-2">
            {QUICK_ACTIONS.map((action) => (
              <QuickActionCircle key={action.to} {...action} />
            ))}
          </div>
        }
      />

      {/* ---------- Top row: stat cards (75%) + Announcements (25%) ---------- */}
      <div className="flex gap-4 mb-6 items-stretch">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 w-3/4">
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={Users}
              label="Total Employees"
              color="orange"
              loading={statsLoading}
              value={stats?.total_employees ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={UserCheck}
              label="Present Today"
              color="green"
              loading={statsLoading}
              value={stats?.present_today ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={UserX}
              label="Absent Today"
              color="red"
              loading={statsLoading}
              value={stats?.absent_today ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={CalendarClock}
              label="On Leave"
              color="blue"
              loading={statsLoading}
              value={stats?.on_leave ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={AlertTriangle}
              label="Late Today"
              color="purple"
              loading={statsLoading}
              value={stats?.late_today ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={Building2}
              label="Departments"
              color="slate"
              loading={statsLoading}
              value={stats?.total_departments ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={MapPin}
              label="Locations"
              color="slate"
              loading={statsLoading}
              value={stats?.total_locations ?? "—"}
            />
          </div>
          <div className="min-w-[170px] w-[170px] shrink-0">
            <StatCard
              icon={Clock3}
              label="Shifts"
              color="slate"
              loading={statsLoading}
              value={stats?.total_shifts ?? "—"}
            />
          </div>
        </div>

        {/* ---------- Announcements: remaining ~25% beside the stat row ---------- */}
        <div className="w-1/4 bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5 mb-2">
            <Megaphone size={15} className="text-orange-500" /> Announcements
          </h3>
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-400">No active announcements.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto no-scrollbar flex-1">
              {announcements.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="bg-amber-50 border border-amber-100 rounded-lg p-2"
                >
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {a.title}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                    {a.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Recent Activity | Today's Attendance ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------- Recent audit activity: fixed height, hidden scrollbar ---------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-[360px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={17} className="text-orange-500" /> Recent
              Activity
            </h3>
            <Link
              to="/super-admin/security/audit-logs"
              className="text-xs text-orange-600 font-medium flex items-center gap-1"
            >
              View Audit Logs <ArrowRight size={12} />
            </Link>
          </div>

          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : logsError ? (
            <div className="text-sm text-red-500">
              Couldn't load recent activity: {logsError}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-400">No recent activity.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-y-auto no-scrollbar flex-1">
              {logs.map((log) => {
                const entry = parseLogEntry(log);
                // Prefer the reverse-geocoded "City, State, Country" (matches
                // what Today's Attendance shows); fall back to the matched
                // company office name if geocoding hasn't resolved yet.
                const geocoded =
                  entry.lat != null && entry.lon != null
                    ? placeCache[placeKey(entry.lat, entry.lon)]
                    : null;
                const locationName =
                  geocoded ||
                  resolveLocationName(entry.lat, entry.lon, locations);
                return (
                  <li key={log.id} className="py-2 flex items-start gap-2.5">
                    <LogIcon kind={entry.kind} />
                    <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {entry.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {entry.action}
                        </p>
                        {locationName && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-0.5 truncate">
                            <MapPin size={9} className="shrink-0" />{" "}
                            {locationName}
                          </p>
                        )}
                      </div>
                      {entry.time && (
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {formatTime(entry.time)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ---------- Check-in/out (Super Admin is a person too) ---------- */}
        <CheckInOutCard onActivityChange={loadLogs} />
      </div>

      {/* ---------- Charts ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <AttendanceTrendChart trend={trend} loading={trendLoading} />
        </div>
        <DepartmentDistributionChart
          departments={deptDistribution}
          loading={deptLoading}
        />
      </div>

      {/* ---------- Floating round "Add Employee" button ---------- */}
      <Link
        to="/super-admin/employees/add"
        title="Add Employee"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg flex items-center justify-center transition-colors z-50"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
