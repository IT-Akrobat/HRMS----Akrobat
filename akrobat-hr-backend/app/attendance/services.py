import math
from datetime import date, datetime, time
from typing import Optional

from fastapi import HTTPException, Request

from app.core.repository import SupabaseRepository
from app.core.responses import success_response
from app.core.logger import logger
from app.core.exceptions import bad_request, forbidden, internal_server_error
from app.core.audit import record_audit_log
from app.core.rbac import has_permission
from app.core.helpers.employee_helper import (
    get_employee_id_for_auth_user,
    is_manager_of,
    get_all_report_ids,
)
from app.core.database import supabase_admin

attendance_repo = SupabaseRepository("attendance")
correction_repo = SupabaseRepository("attendance_corrections")

ATTENDANCE_SELECT = "*, employees(employee_id, full_name)"
CORRECTION_SELECT = "*, employees(employee_id, full_name)"


# ==========================================================================
# POLICY RESOLUTION — shift + attendance_rules drive every calculation
# below; nothing is hardcoded to a fixed 9-to-5.
# ==========================================================================


def _get_attendance_rule() -> dict:
    """
    Company-wide fallback rule (sql/001_schema.sql seeds one: "Default
    Company Rule"). Shift-level `grace_period` / `working_hours` (below)
    take precedence per-employee whenever a shift is resolved; this is
    only the fallback for employees with no shift assigned at all.
    """
    try:
        rule = (
            supabase_admin.table("attendance_rules")
            .select("*")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if rule.data:
            return rule.data[0]
    except Exception as e:
        logger.error(f"Failed to fetch attendance_rules, using defaults: {e}")

    return {
        "late_grace_minutes": 10,
        "minimum_work_minutes": 480,
        "overtime_after_minutes": 480,
    }


def _get_employee_shift(employee_id: str, for_date: date) -> Optional[dict]:
    """
    Resolves the shift that applies to `employee_id` on `for_date`:
      1. An active `employee_shift_history` row covering that date.
      2. Else the employee's default `employees.shift_id`.
      3. If `for_date` is a Saturday and the resolved shift's name doesn't
         already say SATURDAY, look for a sibling shift named
         "<same area> ... SATURDAY" — sql/003_attendance_info_seed.sql
         models weekday vs Saturday hours as separate rows per area
         (e.g. "OFFICE - WEEKDAY (9:00-6:00)" / "OFFICE - SATURDAY").
         Best-effort match; falls back to the weekday shift's own hours
         if no Saturday sibling is found. Schema note: shift assignment
         isn't day-of-week aware, so this is a naming-convention-based
         heuristic, not a first-class model — flagged in REFACTOR_NOTES.
    """

    shift = None

    try:
        history = (
            supabase_admin.table("employee_shift_history")
            .select("effective_from, effective_to, shifts(*)")
            .eq("employee_id", employee_id)
            .lte("effective_from", for_date.isoformat())
            .order("effective_from", desc=True)
            .execute()
        )

        for row in history.data or []:
            effective_to = row.get("effective_to")
            if not effective_to or effective_to >= for_date.isoformat():
                shift = row.get("shifts")
                break
    except Exception as e:
        logger.error(f"Failed to fetch employee_shift_history for {employee_id}: {e}")

    if not shift:
        try:
            employee = (
                supabase_admin.table("employees")
                .select("shift_id, shifts(*)")
                .eq("id", employee_id)
                .maybe_single()
                .execute()
            )
            if employee and employee.data:
                shift = employee.data.get("shifts")
        except Exception as e:
            logger.error(f"Failed to fetch default shift for {employee_id}: {e}")

    if not shift:
        return None

    if (
        for_date.weekday() == 5
        and "SATURDAY" not in (shift.get("shift_name") or "").upper()
    ):
        try:
            area = shift["shift_name"].split(" - ")[0].strip()
            saturday_shift = (
                supabase_admin.table("shifts")
                .select("*")
                .ilike("shift_name", f"{area}%SATURDAY%")
                .limit(1)
                .execute()
            )
            if saturday_shift.data:
                shift = saturday_shift.data[0]
        except Exception as e:
            logger.error(f"Failed to resolve Saturday shift variant: {e}")

    return shift


def _late_minutes(
    check_in_time: datetime, for_date: date, shift: Optional[dict], rule: dict
) -> int:
    if not shift or not shift.get("start_time"):
        return 0

    hh, mm, *_ = str(shift["start_time"]).split(":")
    scheduled_start = datetime.combine(for_date, time(int(hh), int(mm)))

    grace = shift.get("grace_period")
    if grace is None:
        grace = rule.get("late_grace_minutes", 0)

    diff_minutes = (check_in_time - scheduled_start).total_seconds() / 60

    return int(diff_minutes - grace) if diff_minutes > grace else 0


def _minimum_work_minutes(shift: Optional[dict], rule: dict) -> int:
    if shift and shift.get("working_hours"):
        return int(float(shift["working_hours"]) * 60)
    return rule.get("minimum_work_minutes") or 480


def _haversine_meters(lat1, lon1, lat2, lon2) -> float:
    r_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r_km * math.asin(math.sqrt(a)) * 1000


def _validate_geofence(
    location_id: Optional[str], latitude: Optional[float], longitude: Optional[float]
):
    if not location_id or latitude is None or longitude is None:
        return

    location = (
        supabase_admin.table("locations")
        .select("*")
        .eq("id", location_id)
        .maybe_single()
        .execute()
    )

    if not location or not location.data:
        bad_request("Invalid location_id.")

    loc = location.data

    if (
        loc.get("latitude") is None
        or loc.get("longitude") is None
        or not loc.get("radius")
    ):
        return  # location has no geofence configured — nothing to enforce

    distance_m = _haversine_meters(
        latitude, longitude, loc["latitude"], loc["longitude"]
    )

    if distance_m > loc["radius"]:
        bad_request(
            f"You are {int(distance_m)}m from {loc.get('location_name', 'the check-in location')}, "
            f"outside the allowed {loc['radius']}m radius."
        )


# ==========================================================================
# CHECK IN / CHECK OUT (self-service)
# ==========================================================================


def check_in(auth_user_id: str, data, request: Optional[Request] = None):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            forbidden("No employee profile is linked to this account.")

        today = date.today()

        if attendance_repo.find_one(
            {"employee_id": employee_id, "attendance_date": today.isoformat()}
        ):
            bad_request("You have already checked in today.")

        _validate_geofence(data.location_id, data.latitude, data.longitude)

        check_in_time = datetime.now()
        shift = _get_employee_shift(employee_id, today)
        rule = _get_attendance_rule()
        late_minutes = _late_minutes(check_in_time, today, shift, rule)

        payload = {
            "employee_id": employee_id,
            "attendance_date": today.isoformat(),
            "check_in_time": check_in_time.isoformat(),
            "late_minutes": late_minutes,
            "status": "Present",
            "check_in_latitude": data.latitude,
            "check_in_longitude": data.longitude,
        }

        if request is not None:
            payload["ip_address"] = request.client.host if request.client else None
            payload["device_info"] = request.headers.get("user-agent")

        attendance_data = attendance_repo.create(payload)

        record_audit_log(
            module="ATTENDANCE",
            action="CHECK_IN",
            performed_by=auth_user_id,
            target_employee_id=employee_id,
            record_id=attendance_data.get("id"),
            description="Checked in"
            + (f" — {late_minutes} min late" if late_minutes else ""),
            new_values=attendance_data,
            request=request,
        )

        return success_response(
            message="Checked in successfully.", data=attendance_data
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to check in.")


def check_out(auth_user_id: str, data, request: Optional[Request] = None):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            forbidden("No employee profile is linked to this account.")

        today = date.today()

        existing = attendance_repo.find_one(
            {"employee_id": employee_id, "attendance_date": today.isoformat()}
        )

        if not existing:
            bad_request("You haven't checked in today.")

        if existing.get("check_out_time"):
            bad_request("You have already checked out today.")

        check_in_time = datetime.fromisoformat(existing["check_in_time"])
        check_out_time = datetime.now()

        breaks_resp = (
            supabase_admin.table("attendance_breaks")
            .select("break_minutes")
            .eq("attendance_id", existing["id"])
            .execute()
        )
        total_break_minutes = sum(
            (b.get("break_minutes") or 0) for b in (breaks_resp.data or [])
        )

        gross_minutes = int((check_out_time - check_in_time).total_seconds() / 60)
        working_minutes = max(0, gross_minutes - total_break_minutes)

        shift = _get_employee_shift(employee_id, today)
        rule = _get_attendance_rule()
        minimum_work_minutes = _minimum_work_minutes(shift, rule)
        overtime_after_minutes = (
            rule.get("overtime_after_minutes") or minimum_work_minutes
        )

        early_checkout_minutes = max(0, minimum_work_minutes - working_minutes)
        overtime_minutes = max(0, working_minutes - overtime_after_minutes)
        status = (
            "Half Day" if working_minutes < (minimum_work_minutes / 2) else "Present"
        )

        updated = attendance_repo.update(
            existing["id"],
            {
                "check_out_time": check_out_time.isoformat(),
                "break_minutes": total_break_minutes,
                "working_minutes": working_minutes,
                "early_checkout_minutes": early_checkout_minutes,
                "overtime_minutes": overtime_minutes,
                "status": status,
                "check_out_latitude": data.latitude,
                "check_out_longitude": data.longitude,
            },
        )

        record_audit_log(
            module="ATTENDANCE",
            action="CHECK_OUT",
            performed_by=auth_user_id,
            target_employee_id=employee_id,
            record_id=existing["id"],
            description=f"Checked out — {working_minutes} min worked, status: {status}",
            old_values=existing,
            new_values=updated,
            request=request,
        )

        return success_response(message="Checked out successfully.", data=updated)

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to check out.")


# ==========================================================================
# BREAKS (multiple breaks per day)
# ==========================================================================


def start_break(auth_user_id: str, request: Optional[Request] = None):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            forbidden("No employee profile is linked to this account.")

        today = date.today()
        attendance = attendance_repo.find_one(
            {"employee_id": employee_id, "attendance_date": today.isoformat()}
        )

        if not attendance:
            bad_request("You need to check in before starting a break.")

        if attendance.get("check_out_time"):
            bad_request("You have already checked out today.")

        open_break = (
            supabase_admin.table("attendance_breaks")
            .select("id")
            .eq("attendance_id", attendance["id"])
            .is_("break_end", "null")
            .execute()
        )

        if open_break.data:
            bad_request("A break is already in progress.")

        inserted = (
            supabase_admin.table("attendance_breaks")
            .insert(
                {
                    "attendance_id": attendance["id"],
                    "break_start": datetime.now().isoformat(),
                }
            )
            .execute()
        )
        record = inserted.data[0] if inserted.data else None

        record_audit_log(
            module="ATTENDANCE",
            action="BREAK_START",
            performed_by=auth_user_id,
            target_employee_id=employee_id,
            record_id=attendance["id"],
            description="Break started",
            request=request,
        )

        return success_response(message="Break started.", data=record)

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to start break.")


def end_break(auth_user_id: str, request: Optional[Request] = None):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            forbidden("No employee profile is linked to this account.")

        today = date.today()
        attendance = attendance_repo.find_one(
            {"employee_id": employee_id, "attendance_date": today.isoformat()}
        )

        if not attendance:
            bad_request("You haven't checked in today.")

        open_break = (
            supabase_admin.table("attendance_breaks")
            .select("*")
            .eq("attendance_id", attendance["id"])
            .is_("break_end", "null")
            .order("break_start", desc=True)
            .limit(1)
            .execute()
        )

        if not open_break.data:
            bad_request("No break is currently in progress.")

        break_row = open_break.data[0]
        break_start = datetime.fromisoformat(break_row["break_start"])
        break_end = datetime.now()
        break_minutes = int((break_end - break_start).total_seconds() / 60)

        updated_break = (
            supabase_admin.table("attendance_breaks")
            .update(
                {"break_end": break_end.isoformat(), "break_minutes": break_minutes}
            )
            .eq("id", break_row["id"])
            .execute()
        )

        totals_resp = (
            supabase_admin.table("attendance_breaks")
            .select("break_minutes")
            .eq("attendance_id", attendance["id"])
            .execute()
        )
        total_break_minutes = sum(
            (b.get("break_minutes") or 0) for b in (totals_resp.data or [])
        )

        attendance_repo.update(attendance["id"], {"break_minutes": total_break_minutes})

        record_audit_log(
            module="ATTENDANCE",
            action="BREAK_END",
            performed_by=auth_user_id,
            target_employee_id=employee_id,
            record_id=attendance["id"],
            description=f"Break ended — {break_minutes} min",
            request=request,
        )

        record = updated_break.data[0] if updated_break.data else None
        return success_response(message="Break ended.", data=record)

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to end break.")


# ==========================================================================
# HISTORY / TIMELINE (self-service)
# ==========================================================================


def get_my_attendance(
    auth_user_id: str, from_date: Optional[date] = None, to_date: Optional[date] = None
):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            return success_response(
                message="Attendance history fetched successfully.", data=[]
            )

        query = (
            supabase_admin.table("attendance")
            .select("*")
            .eq("employee_id", employee_id)
        )

        if from_date:
            query = query.gte("attendance_date", from_date.isoformat())
        if to_date:
            query = query.lte("attendance_date", to_date.isoformat())

        response = query.order("attendance_date", desc=True).execute()

        return success_response(
            message="Attendance history fetched successfully.", data=response.data or []
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch attendance history.")


def get_attendance_timeline(auth_user_id: str, target_date: date):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            return success_response(
                message="Attendance timeline fetched successfully.", data=None
            )

        attendance = attendance_repo.find_one(
            {"employee_id": employee_id, "attendance_date": target_date.isoformat()}
        )

        if not attendance:
            return success_response(
                message="No attendance record for this date.", data=None
            )

        breaks_resp = (
            supabase_admin.table("attendance_breaks")
            .select("*")
            .eq("attendance_id", attendance["id"])
            .order("break_start")
            .execute()
        )

        return success_response(
            message="Attendance timeline fetched successfully.",
            data={**attendance, "breaks": breaks_resp.data or []},
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch attendance timeline.")


# ==========================================================================
# REGULARIZATION
# ==========================================================================


def submit_regularization(auth_user_id: str, data, request: Optional[Request] = None):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            forbidden("No employee profile is linked to this account.")

        attendance = attendance_repo.find_one(
            {
                "employee_id": employee_id,
                "attendance_date": data.attendance_date.isoformat(),
            }
        )

        payload = {
            "employee_id": employee_id,
            "attendance_id": attendance["id"] if attendance else None,
            "requested_check_in": data.requested_check_in.isoformat(),
            "requested_check_out": (
                data.requested_check_out.isoformat()
                if data.requested_check_out
                else None
            ),
            "reason": data.reason,
            "status": "Pending",
        }

        created = correction_repo.create(payload)

        record_audit_log(
            module="ATTENDANCE",
            action="REGULARIZATION_REQUEST",
            performed_by=auth_user_id,
            target_employee_id=employee_id,
            record_id=created.get("id"),
            description=f"Regularization requested for {data.attendance_date}: {data.reason}",
            new_values=created,
            request=request,
        )

        return success_response(
            message="Regularization request submitted.", data=created
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to submit regularization request.")


def get_my_regularizations(auth_user_id: str):
    try:
        employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not employee_id:
            return success_response(
                message="Regularization requests fetched successfully.", data=[]
            )

        records, _total = correction_repo.list(
            filters={"employee_id": employee_id}, order_by="created_at", ascending=False
        )

        return success_response(
            message="Regularization requests fetched successfully.", data=records
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch regularization requests.")


def get_team_regularizations(auth_user_id: str):
    try:
        manager_employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not manager_employee_id:
            return success_response(
                message="Team regularization requests fetched successfully.", data=[]
            )

        report_ids = get_all_report_ids(manager_employee_id)

        if not report_ids:
            return success_response(
                message="Team regularization requests fetched successfully.", data=[]
            )

        response = (
            supabase_admin.table("attendance_corrections")
            .select(CORRECTION_SELECT)
            .in_("employee_id", report_ids)
            .eq("status", "Pending")
            .order("created_at", desc=True)
            .execute()
        )

        return success_response(
            message="Team regularization requests fetched successfully.",
            data=response.data or [],
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch team regularization requests.")


def decide_regularization(
    correction_id: str, data, auth_user_id: str, request: Optional[Request] = None
):
    try:
        existing = correction_repo.get_by_id_or_404(
            correction_id, "Regularization request not found."
        )

        if existing.get("status") != "Pending":
            bad_request(
                f"This regularization request has already been {str(existing.get('status')).lower()}."
            )

        target_employee_id = existing.get("employee_id")
        approver_employee_id = get_employee_id_for_auth_user(auth_user_id)

        has_full_access = has_permission(
            auth_user_id, "EDIT_ATTENDANCE"
        ) or has_permission(auth_user_id, "VIEW_ALL_ATTENDANCE")
        is_direct_or_indirect_manager = is_manager_of(
            approver_employee_id, target_employee_id
        )

        if not has_full_access and not is_direct_or_indirect_manager:
            forbidden(
                "You don't have permission to approve or reject this regularization request."
            )

        if approver_employee_id and approver_employee_id == target_employee_id:
            forbidden("You cannot approve or reject your own regularization request.")

        updated = (
            supabase_admin.table("attendance_corrections")
            .update({"status": data.status, "approved_by": approver_employee_id})
            .eq("id", correction_id)
            .execute()
        )
        updated_row = updated.data[0] if updated.data else None

        if data.status == "Approved" and existing.get("attendance_id"):
            patch = {"status": "Present"}
            if existing.get("requested_check_in"):
                patch["check_in_time"] = existing["requested_check_in"]
            if existing.get("requested_check_out"):
                patch["check_out_time"] = existing["requested_check_out"]

            attendance_repo.update(existing["attendance_id"], patch)

        record_audit_log(
            module="ATTENDANCE",
            action=data.status.upper(),
            performed_by=auth_user_id,
            target_employee_id=target_employee_id,
            record_id=correction_id,
            description=(
                f"Regularization request {data.status.lower()}"
                + (f" — {data.comments}" if data.comments else "")
            ),
            old_values=existing,
            new_values=updated_row,
            request=request,
        )

        return success_response(
            message=f"Regularization request {data.status.lower()}.", data=updated_row
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to update regularization request.")


# ==========================================================================
# TEAM / COMPANY-WIDE VIEWS
# ==========================================================================


def get_team_attendance(auth_user_id: str, target_date: Optional[date] = None):
    try:
        manager_employee_id = get_employee_id_for_auth_user(auth_user_id)

        if not manager_employee_id:
            return success_response(
                message="Team attendance fetched successfully.", data=[]
            )

        report_ids = get_all_report_ids(manager_employee_id)

        if not report_ids:
            return success_response(
                message="Team attendance fetched successfully.", data=[]
            )

        day = target_date or date.today()

        response = (
            supabase_admin.table("attendance")
            .select(ATTENDANCE_SELECT)
            .in_("employee_id", report_ids)
            .eq("attendance_date", day.isoformat())
            .execute()
        )

        return success_response(
            message="Team attendance fetched successfully.", data=response.data or []
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch team attendance.")


def get_all_attendance(
    page: int = 1, limit: int = 50, target_date: Optional[date] = None
):
    try:
        start = (max(page, 1) - 1) * max(min(limit, 200), 1)
        end = start + max(min(limit, 200), 1) - 1

        filters = {"attendance_date": target_date.isoformat()} if target_date else None

        records, total = attendance_repo.list(
            select=ATTENDANCE_SELECT,
            filters=filters,
            order_by="attendance_date",
            ascending=False,
            start=start,
            end=end,
        )

        return success_response(
            message="Attendance fetched successfully.",
            data={"records": records, "total": total, "page": page, "limit": limit},
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch attendance.")


def get_employee_attendance(
    employee_id: str, auth_user_id: str, page: int = 1, limit: int = 50
):
    try:
        if not has_permission(auth_user_id, "VIEW_ALL_ATTENDANCE"):
            own_employee_id = get_employee_id_for_auth_user(auth_user_id)

            if not own_employee_id or own_employee_id != employee_id:
                forbidden(
                    "You don't have permission to view this employee's attendance."
                )

        start = (max(page, 1) - 1) * max(min(limit, 200), 1)
        end = start + max(min(limit, 200), 1) - 1

        records, total = attendance_repo.list(
            select=ATTENDANCE_SELECT,
            filters={"employee_id": employee_id},
            order_by="attendance_date",
            ascending=False,
            start=start,
            end=end,
        )

        return success_response(
            message="Attendance fetched successfully.",
            data={"records": records, "total": total, "page": page, "limit": limit},
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch employee attendance.")


def get_attendance_analytics(from_date: date, to_date: date):
    try:
        response = (
            supabase_admin.table("attendance")
            .select("status, late_minutes, overtime_minutes, working_minutes")
            .gte("attendance_date", from_date.isoformat())
            .lte("attendance_date", to_date.isoformat())
            .execute()
        )

        rows = response.data or []
        total_records = len(rows)
        present_count = sum(1 for r in rows if r.get("status") == "Present")
        half_day_count = sum(1 for r in rows if r.get("status") == "Half Day")
        late_count = sum(1 for r in rows if (r.get("late_minutes") or 0) > 0)
        total_overtime_minutes = sum((r.get("overtime_minutes") or 0) for r in rows)
        average_working_minutes = (
            round(sum((r.get("working_minutes") or 0) for r in rows) / total_records, 1)
            if total_records
            else 0
        )

        return success_response(
            message="Attendance analytics fetched successfully.",
            data={
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "total_records": total_records,
                "present_count": present_count,
                "half_day_count": half_day_count,
                "late_count": late_count,
                "average_working_minutes": average_working_minutes,
                "total_overtime_minutes": total_overtime_minutes,
            },
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch attendance analytics.")


# ==========================================================================
# HR / ADMIN DIRECT EDIT
# ==========================================================================


def admin_update_attendance(
    attendance_id: str, data, current_user=None, request: Optional[Request] = None
):
    try:
        existing = attendance_repo.get_by_id_or_404(
            attendance_id, "Attendance record not found."
        )

        values = data.model_dump(exclude_unset=True)

        for key in ("check_in_time", "check_out_time"):
            if key in values and values[key] is not None:
                values[key] = values[key].isoformat()

        updated = attendance_repo.update(attendance_id, values)

        record_audit_log(
            module="ATTENDANCE",
            action="ADMIN_UPDATE",
            performed_by=getattr(current_user, "id", None),
            target_employee_id=updated.get("employee_id"),
            record_id=attendance_id,
            description="Attendance record manually updated by HR/Admin",
            old_values=existing,
            new_values=updated,
            request=request,
        )

        return success_response(message="Attendance record updated.", data=updated)

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to update attendance record.")
