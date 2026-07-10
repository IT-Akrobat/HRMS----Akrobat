from datetime import date, timedelta

from fastapi import HTTPException

from app.core.database import supabase_admin


def get_admin_dashboard():

    try:

        today = str(date.today())

        employees = supabase_admin.table("employees").select("id").execute()

        attendance = (
            supabase_admin.table("attendance")
            .select("id")
            .eq("attendance_date", today)
            .execute()
        )

        # NOTE: previously filtered on a "leave_date" column on a "leaves"
        # table — neither exists. The real table is "leave_requests" (see
        # app/leaves/services.py), leaves are ranges (start_date/end_date),
        # and status is a capitalised "Approved". So on_leave was always 0
        # (or a hard 500, depending on which bug fired). Fixed to check "is
        # this leave's range covering today" against the real table.
        leaves = (
            supabase_admin.table("leave_requests")
            .select("id")
            .eq("status", "Approved")
            .lte("start_date", today)
            .gte("end_date", today)
            .execute()
        )

        departments = supabase_admin.table("departments").select("id").execute()

        locations = supabase_admin.table("locations").select("id").execute()

        shifts = supabase_admin.table("shifts").select("id").execute()

        late = (
            supabase_admin.table("attendance")
            .select("id")
            .eq("attendance_date", today)
            .gt("late_minutes", 0)
            .execute()
        )

        total_employees = len(employees.data)

        present_today = len(attendance.data)

        on_leave = len(leaves.data)

        total_departments = len(departments.data)

        total_locations = len(locations.data)

        total_shifts = len(shifts.data)

        late_today = len(late.data)

        absent_today = max(0, total_employees - present_today - on_leave)

        return {
            "total_employees": total_employees,
            "present_today": present_today,
            "absent_today": absent_today,
            "on_leave": on_leave,
            "late_today": late_today,
            "total_departments": total_departments,
            "total_locations": total_locations,
            "total_shifts": total_shifts,
        }

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


def get_attendance_trend(days: int = 7):
    """Present / late / on-leave / absent counts per day, for the last
    `days` days (inclusive of today) — feeds the dashboard trend chart.
    Bucketed in Python from two range queries rather than one query per
    day, so this stays cheap regardless of how many days are requested.
    """

    try:

        end = date.today()

        start = end - timedelta(days=days - 1)

        total_employees = len(
            supabase_admin.table("employees").select("id").execute().data or []
        )

        attendance_rows = (
            supabase_admin.table("attendance")
            .select("attendance_date, late_minutes")
            .gte("attendance_date", start.isoformat())
            .lte("attendance_date", end.isoformat())
            .execute()
            .data
            or []
        )

        # A leave counts for a given day if that day falls inside its
        # start_date/end_date range — same table/fix as get_admin_dashboard
        # above (real table is "leave_requests", not "leaves").
        leave_rows = (
            supabase_admin.table("leave_requests")
            .select("start_date, end_date")
            .eq("status", "Approved")
            .lte("start_date", end.isoformat())
            .gte("end_date", start.isoformat())
            .execute()
            .data
            or []
        )

        buckets = {}
        cursor = start
        while cursor <= end:
            buckets[cursor.isoformat()] = {
                "date": cursor.isoformat(),
                "present": 0,
                "late": 0,
                "on_leave": 0,
                "absent": 0,
            }
            cursor += timedelta(days=1)

        for row in attendance_rows:
            bucket = buckets.get(row.get("attendance_date"))
            if not bucket:
                continue
            bucket["present"] += 1
            if (row.get("late_minutes") or 0) > 0:
                bucket["late"] += 1

        for row in leave_rows:
            row_start = row.get("start_date")
            row_end = row.get("end_date")
            if not row_start or not row_end:
                continue
            cursor = max(date.fromisoformat(row_start), start)
            last = min(date.fromisoformat(row_end), end)
            while cursor <= last:
                bucket = buckets.get(cursor.isoformat())
                if bucket:
                    bucket["on_leave"] += 1
                cursor += timedelta(days=1)

        trend = list(buckets.values())
        for bucket in trend:
            bucket["absent"] = max(
                0, total_employees - bucket["present"] - bucket["on_leave"]
            )

        return {"days": days, "total_employees": total_employees, "trend": trend}

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


def get_department_distribution():
    """Employee count per department — feeds the dashboard donut chart."""

    try:

        departments = (
            supabase_admin.table("departments")
            .select("id, department_name")
            .execute()
            .data
            or []
        )

        employees = (
            supabase_admin.table("employees").select("department_id").execute().data
            or []
        )

        counts = {}
        for row in employees:
            dept_id = row.get("department_id")
            counts[dept_id] = counts.get(dept_id, 0) + 1

        result = [
            {
                "department_id": dept["id"],
                "department_name": dept["department_name"],
                "employee_count": counts.get(dept["id"], 0),
            }
            for dept in departments
        ]

        unassigned = counts.get(None, 0)
        if unassigned:
            result.append(
                {
                    "department_id": None,
                    "department_name": "Unassigned",
                    "employee_count": unassigned,
                }
            )

        result.sort(key=lambda d: d["employee_count"], reverse=True)

        return {"departments": result}

    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))
