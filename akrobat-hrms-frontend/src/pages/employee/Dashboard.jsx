import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Megaphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import PageHeader from "../../components/common/PageHeader";

import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

// Everything here is scoped to "me" — /leaves/my, /attendance (via
// CheckInOutCard), /announcements/active, /holidays. No company-wide
// numbers belong on this page; an Employee has no VIEW_EMPLOYEE /
// VIEW_ATTENDANCE permission (see the permission matrix), so those
// endpoints would 403 anyway.
//
// NOTE: there's a `leave_balances` table in the schema
// (sql/001_schema.sql) but no GET /leaves/balance endpoint wired up yet
// to read from it — so the "Leave Balance" widget below counts this
// year's *requests* by status from GET /leaves/my instead of showing a
// true remaining-days balance. Swap this out once that endpoint exists.

export default function EmployeeDashboard() {
  const { user } = useAuth();

  const [leaveCounts, setLeaveCounts] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    apiClient
      .get("/leaves/my")
      .then((res) => {
        const rows = res.data || [];
        setLeaveCounts({
          approved: rows.filter((r) => r.status === "Approved").length,
          pending: rows.filter((r) => r.status === "Pending").length,
          rejected: rows.filter((r) => r.status === "Rejected").length,
        });
      })
      .catch(() => setLeaveCounts(null));

    apiClient
      .get("/holidays/")
      .then((res) => {
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = (res.data || [])
          .filter((h) => h.holiday_date >= today)
          .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
        setHolidays(upcoming.slice(0, 4));
      })
      .catch(() => setHolidays([]));

    apiClient
      .get("/announcements/active")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));
  }, []);

  return (
    <div>
      <PageHeader
        title={`Good Morning, ${user?.name?.split(" ")[0] || "there"} 👋`}
        subtitle="Welcome back! Here's what's happening today."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <CheckInOutCard />

        {/* ---------- Leave summary (see note above re: no balance endpoint yet) ---------- */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <CalendarCheck2 size={17} className="text-orange-500" /> My Leave
              Requests
            </h3>
            <Link
              to="/employee/leave/history"
              className="text-xs text-orange-600 font-medium flex items-center gap-1"
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>
          {leaveCounts ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-emerald-600">
                  {leaveCounts.approved}
                </div>
                <div className="text-xs text-slate-400">Approved</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-500">
                  {leaveCounts.pending}
                </div>
                <div className="text-xs text-slate-400">Pending</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-500">
                  {leaveCounts.rejected}
                </div>
                <div className="text-xs text-slate-400">Rejected</div>
              </div>
            </div>
          ) : (
            <div className="h-12 bg-slate-100 rounded animate-pulse" />
          )}
          <Link
            to="/employee/leave/apply"
            className="block text-center mt-4 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition-colors"
          >
            Apply for Leave
          </Link>
        </div>

        {/* ---------- Upcoming holidays ---------- */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <CalendarDays size={17} className="text-orange-500" /> Upcoming
            Holidays
          </h3>
          {holidays.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming holidays.</p>
          ) : (
            <ul className="space-y-2.5">
              {holidays.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">{h.holiday_name}</span>
                  <span className="text-slate-400 text-xs">
                    {new Date(h.holiday_date).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Announcements ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Megaphone size={17} className="text-orange-500" /> Announcements
          </h3>
        </div>
        {announcements.length === 0 ? (
          <p className="text-sm text-slate-400">No active announcements.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {announcements.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="bg-amber-50 border border-amber-100 rounded-lg p-3"
              >
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
