from fastapi import APIRouter, Depends, Query

from app.dashboard.schemas import DashboardStats

from app.dashboard.services import (
    get_admin_dashboard,
    get_attendance_trend,
    get_department_distribution,
)

from app.core.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/", response_model=DashboardStats)
def dashboard(user=Depends(get_current_user)):

    return get_admin_dashboard()


@router.get("/attendance-trend")
def attendance_trend(
    days: int = Query(7, ge=2, le=30),
    user=Depends(get_current_user),
):

    return get_attendance_trend(days=days)


@router.get("/department-distribution")
def department_distribution(user=Depends(get_current_user)):

    return get_department_distribution()
