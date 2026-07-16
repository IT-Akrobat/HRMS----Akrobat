import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import CelebrationsStrip from "../../components/common/Celebrationsstrip ";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import HolidaysCalendarCard from "../../components/common/Holidayscalendarcard ";
import PageHeader from "../../components/common/PageHeader";
import QuoteOfDayCard from "../../components/common/Quoteofdaycard ";

import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

// Everything here is scoped to "me" (or, for Holidays/Celebrations,
// company-wide but non-sensitive) — /announcements/active, /holidays,
// /dashboard/celebrations. No org-wide headcount/attrition numbers
// belong on this page; an Employee has no VIEW_EMPLOYEE /
// VIEW_ATTENDANCE permission (see the permission matrix), so those
// endpoints would 403 anyway.
//
// Layout:
//   Good Morning header
//   Row 1: Check-in/out            | Quote of the Day
//   Row 2: Upcoming Holidays (SG/IN tabs) | Announcements
//   Row 3: Birthdays & Work Anniversaries — a loose horizontal strip,
//          deliberately NOT another bordered card/grid (see
//          CelebrationsStrip.jsx), so it reads as a lightweight note.

export default function EmployeeDashboard() {
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
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

      {/* ---------- Row 1: Check-in/out | Quote of the Day ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <CheckInOutCard />
        <QuoteOfDayCard />
      </div>

      {/* ---------- Row 2: Upcoming Holidays | Announcements ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <HolidaysCalendarCard />

        <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Megaphone size={17} className="text-orange-500" /> Announcements
            </h3>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-400">No active announcements.</p>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 4).map((a) => (
                <div
                  key={a.id}
                  className="bg-orange-50 border border-orange-100 rounded-lg p-3"
                >
                  <p className="text-sm font-medium text-slate-800">
                    {a.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {a.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Row 3: Birthdays & Work Anniversaries ---------------- */}
      <CelebrationsStrip />
    </div>
  );
}
