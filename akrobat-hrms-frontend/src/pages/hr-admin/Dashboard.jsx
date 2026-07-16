import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Megaphone,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { apiClient } from "../../services/apiClient";

export default function HrAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);

  const [announcements, setAnnouncements] = useState([]);

  function loadPendingLeaves() {
    setLeavesLoading(true);
    apiClient
      .get("/leaves/?status=Pending&limit=5")
      .then((res) => setPendingLeaves(res.data || []))
      .catch(() => setPendingLeaves([]))
      .finally(() => setLeavesLoading(false));
  }

  useEffect(() => {
    // Same company-wide endpoint the Super Admin dashboard uses — HR Admin
    // needs the full picture too, not just their own team.
    apiClient
      .get("/dashboard/")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));

    loadPendingLeaves();

    apiClient
      .get("/announcements/active")
      .then((res) => setAnnouncements(res.data || []))
      .catch(() => setAnnouncements([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="HR Dashboard"
        subtitle="Company-wide attendance, leave, and workforce overview"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Employees"
          color="orange"
          loading={statsLoading}
          value={stats?.total_employees ?? "—"}
        />
        <StatCard
          icon={UserCheck}
          label="Present Today"
          color="green"
          loading={statsLoading}
          value={stats?.present_today ?? "—"}
        />
        <StatCard
          icon={UserX}
          label="Absent Today"
          color="red"
          loading={statsLoading}
          value={stats?.absent_today ?? "—"}
        />
        <StatCard
          icon={CalendarClock}
          label="On Leave"
          color="blue"
          loading={statsLoading}
          value={stats?.on_leave ?? "—"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Late Today"
          color="purple"
          loading={statsLoading}
          value={stats?.late_today ?? "—"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------- Pending leave requests (view-only — Super Admin approves) ---------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList size={17} className="text-orange-500" /> Pending
              Leave Requests
            </h3>
            <Link
              to="/hr-admin/leave/requests"
              className="text-xs text-orange-600 font-medium flex items-center gap-1"
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>

          {leavesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : pendingLeaves.length === 0 ? (
            <p className="text-sm text-slate-400">No pending leave requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingLeaves.map((leave) => (
                <li
                  key={leave.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {leave.employees?.full_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {leave.leave_types?.leave_name} · {leave.from_date} →{" "}
                      {leave.to_date}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-50 text-orange-600">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CheckInOutCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Megaphone size={17} className="text-orange-500" /> Announcements
            </h3>
          </div>
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-400">No active announcements.</p>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 3).map((a) => (
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

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/hr-admin/employees/add"
              className="text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg py-3 px-2 text-center"
            >
              Add Employee
            </Link>
            <Link
              to="/hr-admin/leave/requests"
              className="text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg py-3 px-2 text-center"
            >
              Leave Requests
            </Link>
            <Link
              to="/hr-admin/attendance/reports"
              className="text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg py-3 px-2 text-center"
            >
              Attendance Reports
            </Link>
            <Link
              to="/hr-admin/organization/departments"
              className="text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg py-3 px-2 text-center"
            >
              Departments
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
