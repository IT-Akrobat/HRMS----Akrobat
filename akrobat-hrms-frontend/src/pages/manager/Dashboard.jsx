import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CheckInOutCard from "../../components/common/CheckInOutCard";
import StatCard from "../../components/common/StatCard";
import PageHeader from "../../components/common/PageHeader";

import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

// This one page serves MANAGER, OPERATIONS MANAGER, and INSPECTION MANAGER
// (and TEAM LEADER, until it gets its own area) — see normalizeRole() in
// src/config/roles.js. GET /attendance/team and GET /leaves/team are both
// already scoped server-side to "this caller's direct + indirect reports"
// (see get_all_report_ids in the backend), so no extra role branching is
// needed here — the data returned is naturally different per manager.
//
// Note: INSPECTION MANAGER doesn't hold APPROVE_LEAVE (see the permission
// matrix) — for that role PUT /leaves/{id} will 403. The Approve/Reject
// buttons are left in place since the backend is the source of truth and
// will reject correctly; hiding them client-side per sub-role would need
// the raw backend role name (user.backendRole) rather than the normalized
// one, which is available if you want to add that polish later.

export default function ManagerDashboard() {
  const { user } = useAuth();

  const [teamAttendance, setTeamAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const [teamLeaves, setTeamLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);

  function loadTeamLeaves() {
    setLeavesLoading(true);
    apiClient
      .get("/leaves/team")
      .then((res) =>
        setTeamLeaves((res.data || []).filter((l) => l.status === "Pending")),
      )
      .catch(() => setTeamLeaves([]))
      .finally(() => setLeavesLoading(false));
  }

  useEffect(() => {
    apiClient
      .get("/attendance/team")
      .then((res) => setTeamAttendance(res.data || []))
      .catch(() => setTeamAttendance([]))
      .finally(() => setAttendanceLoading(false));

    loadTeamLeaves();
  }, []);

  async function decide(leaveId, status) {
    setActingOn(leaveId);
    try {
      await apiClient.put(`/leaves/${leaveId}`, { status });
      loadTeamLeaves();
    } catch (err) {
      alert(err.message);
    } finally {
      setActingOn(null);
    }
  }

  const presentCount = teamAttendance.filter(
    (a) => a.status === "Present",
  ).length;

  return (
    <div>
      <PageHeader
        title={`Good Morning, ${user?.name?.split(" ")[0] || "Manager"}`}
        subtitle="Here's how your team is doing today"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Team Size"
          color="orange"
          loading={attendanceLoading}
          value={teamAttendance.length || "—"}
        />
        <StatCard
          icon={UserCheck}
          label="Present Today"
          color="green"
          loading={attendanceLoading}
          value={presentCount}
        />
        <StatCard
          icon={CalendarClock}
          label="Pending Approvals"
          color="blue"
          loading={leavesLoading}
          value={teamLeaves.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------- Pending team leave approvals ---------- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardCheck size={17} className="text-orange-500" /> Pending
              Leave Approvals
            </h3>
            <Link
              to="/manager/leave/pending"
              className="text-xs text-orange-600 font-medium flex items-center gap-1"
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>

          {leavesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded animate-pulse"
                />
              ))}
            </div>
          ) : teamLeaves.length === 0 ? (
            <p className="text-sm text-slate-400">
              No pending leave requests from your team.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {teamLeaves.map((leave) => (
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
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => decide(leave.id, "Approved")}
                      disabled={actingOn === leave.id}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => decide(leave.id, "Rejected")}
                      disabled={actingOn === leave.id}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CheckInOutCard />
      </div>

      {/* ---------- Team attendance snapshot ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">
            Team Attendance — Today
          </h3>
          <Link
            to="/manager/team/members"
            className="text-xs text-orange-600 font-medium flex items-center gap-1"
          >
            View Team <ArrowRight size={12} />
          </Link>
        </div>

        {attendanceLoading ? (
          <div className="h-24 bg-slate-100 rounded animate-pulse" />
        ) : teamAttendance.length === 0 ? (
          <p className="text-sm text-slate-400">
            No attendance records for your team today.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Employee</th>
                <th className="pb-2 font-medium">Check In</th>
                <th className="pb-2 font-medium">Check Out</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {teamAttendance.slice(0, 6).map((row) => (
                <tr key={row.id}>
                  <td className="py-2 text-slate-700">
                    {row.employees?.full_name || "—"}
                  </td>
                  <td className="py-2 text-slate-500">
                    {row.check_in_time
                      ? new Date(row.check_in_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="py-2 text-slate-500">
                    {row.check_out_time
                      ? new Date(row.check_out_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.status === "Present"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-red-50 text-red-500"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
