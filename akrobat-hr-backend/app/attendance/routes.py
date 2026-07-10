from datetime import date

from fastapi import APIRouter, Depends, Query, Request

from app.attendance.schemas import (
    CheckInRequest,
    CheckOutRequest,
    RegularizationRequest,
    RegularizationDecisionRequest,
    AdminUpdateAttendanceRequest,
)

from app.attendance.services import (
    check_in,
    check_out,
    start_break,
    end_break,
    get_my_attendance,
    get_attendance_timeline,
    submit_regularization,
    get_my_regularizations,
    get_team_regularizations,
    decide_regularization,
    get_team_attendance,
    get_all_attendance,
    get_employee_attendance,
    get_attendance_analytics,
    admin_update_attendance,
)

from app.core.security import get_current_user
from app.core.rbac import require_permission, require_any_permission

router = APIRouter(prefix="/attendance", tags=["Attendance"])


# ==========================================
# CHECK IN / CHECK OUT / BREAKS (self-service)
# ==========================================


@router.post("/check-in")
def employee_check_in(data: CheckInRequest, request: Request, user=Depends(get_current_user)):
    return check_in(user.id, data, request=request)


@router.post("/check-out")
def employee_check_out(data: CheckOutRequest, request: Request, user=Depends(get_current_user)):
    return check_out(user.id, data, request=request)


@router.post("/break-start")
def employee_break_start(request: Request, user=Depends(get_current_user)):
    return start_break(user.id, request=request)


@router.post("/break-end")
def employee_break_end(request: Request, user=Depends(get_current_user)):
    return end_break(user.id, request=request)


# ==========================================
# HISTORY / TIMELINE (self-service)
# ==========================================


@router.get("/my")
def my_attendance(
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user=Depends(get_current_user),
):
    return get_my_attendance(user.id, from_date=from_date, to_date=to_date)


@router.get("/timeline/{target_date}")
def attendance_timeline(target_date: date, user=Depends(get_current_user)):
    return get_attendance_timeline(user.id, target_date)


# ==========================================
# REGULARIZATION
# ==========================================


@router.post("/regularization")
def create_regularization(
    data: RegularizationRequest, request: Request, user=Depends(get_current_user)
):
    return submit_regularization(user.id, data, request=request)


@router.get("/regularization/my")
def my_regularizations(user=Depends(get_current_user)):
    return get_my_regularizations(user.id)


@router.get("/regularization/team")
def team_regularizations(user=Depends(require_permission("VIEW_ATTENDANCE"))):
    return get_team_regularizations(user.id)


@router.put("/regularization/{correction_id}")
def decide_regularization_route(
    correction_id: str,
    data: RegularizationDecisionRequest,
    request: Request,
    user=Depends(require_any_permission(["EDIT_ATTENDANCE", "APPROVE_ATTENDANCE_CORRECTION"])),
):
    return decide_regularization(correction_id, data, auth_user_id=user.id, request=request)


# ==========================================
# TEAM / COMPANY-WIDE VIEWS
# ==========================================


@router.get("/team")
def team_attendance(
    target_date: date | None = Query(None),
    user=Depends(require_permission("VIEW_ATTENDANCE")),
):
    return get_team_attendance(user.id, target_date=target_date)


@router.get("/analytics")
def attendance_analytics(
    from_date: date = Query(...),
    to_date: date = Query(...),
    user=Depends(require_permission("VIEW_ALL_ATTENDANCE")),
):
    return get_attendance_analytics(from_date, to_date)


@router.get("/employee/{employee_id}")
def employee_attendance(
    employee_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
):
    return get_employee_attendance(employee_id, auth_user_id=user.id, page=page, limit=limit)


@router.get("/")
def all_attendance(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    target_date: date | None = Query(None),
    user=Depends(require_permission("VIEW_ALL_ATTENDANCE")),
):
    return get_all_attendance(page=page, limit=limit, target_date=target_date)


# ==========================================
# HR / ADMIN DIRECT EDIT
# ==========================================


@router.put("/{attendance_id}")
def update_attendance(
    attendance_id: str,
    data: AdminUpdateAttendanceRequest,
    request: Request,
    user=Depends(require_permission("EDIT_ATTENDANCE")),
):
    return admin_update_attendance(attendance_id, data, current_user=user, request=request)
