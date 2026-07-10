from fastapi import APIRouter, Depends

from app.core.security import get_current_user

from app.reports.services import (
    employee_report,
    attendance_report,
    today_attendance,
    leave_report,
    payroll_report,
    project_report,
    dashboard_report,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/employees")
def employees(user=Depends(get_current_user)):

    return employee_report()


@router.get("/attendance")
def attendance(user=Depends(get_current_user)):

    return attendance_report()


@router.get("/attendance/today")
def attendance_today(user=Depends(get_current_user)):

    return today_attendance()


@router.get("/leaves")
def leaves(user=Depends(get_current_user)):

    return leave_report()


@router.get("/payroll")
def payroll(user=Depends(get_current_user)):

    return payroll_report()


@router.get("/projects")
def projects(user=Depends(get_current_user)):

    return project_report()


@router.get("/dashboard")
def dashboard(user=Depends(get_current_user)):

    return dashboard_report()
