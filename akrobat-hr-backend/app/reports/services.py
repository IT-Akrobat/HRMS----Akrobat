from datetime import date

from fastapi import HTTPException

from app.core.database import supabase_admin
from app.core.responses import success_response

# =========================
# EMPLOYEE REPORT
# =========================


def employee_report():

    try:

        # NOTE: departments/designations don't have a "name" column (it's
        # department_name / designation_name — see sql/001_schema.sql), and
        # employees has no direct FK to roles (role lives on user_profiles),
        # so the previous embed here would fail at the PostgREST layer.
        #
        # departments(department_name) is also ambiguous on its own: there
        # are two FKs between employees and departments — the normal
        # employees.department_id -> departments.id, and
        # departments.manager_id -> employees.id (the department's manager).
        # PostgREST needs the explicit FK name to know which one to walk.
        response = supabase_admin.table("employees").select("""
            *,
            departments!employees_department_id_fkey(department_name),
            designations(designation_name)
            """).execute()

        return success_response(
            message="Employee report fetched successfully", data=response.data
        )

    except Exception as e:

        raise HTTPException(500, str(e))


# =========================
# ATTENDANCE REPORT
# =========================


def attendance_report():

    try:

        response = supabase_admin.table("attendance").select("""
            *,
            employees(
                full_name,
                employee_id
            )
            """).order("attendance_date", desc=True).execute()

        return success_response(
            message="Attendance report fetched successfully", data=response.data
        )

    except Exception as e:

        raise HTTPException(500, str(e))


# =========================
# TODAY ATTENDANCE
# =========================


def today_attendance():

    try:

        today = str(date.today())

        response = supabase_admin.table("attendance").select("""
            *,
            employees(
                full_name,
                employee_id
            )
            """).eq("attendance_date", today).execute()

        return success_response(
            message="Today's attendance fetched successfully", data=response.data
        )

    except Exception as e:

        raise HTTPException(500, str(e))


# =========================
# LEAVE REPORT
# =========================


def leave_report():

    try:

        # NOTE: schema table is "leave_requests" (see sql/001_schema.sql) —
        # this previously queried a non-existent "leaves" table, which made
        # GET /reports/leaves fail with a 500 on every call.
        response = supabase_admin.table("leave_requests").select("""
            *,
            employees(
                full_name,
                employee_id
            )
            """).execute()

        return success_response(
            message="Leave report fetched successfully", data=response.data
        )

    except Exception as e:

        raise HTTPException(500, str(e))


# =========================
# PAYROLL REPORT
# =========================


def payroll_report():

    try:

        response = supabase_admin.table("payroll").select("""
            *,
            employees(
                full_name,
                employee_id
            )
            """).execute()

        return success_response(
            message="Payroll report fetched successfully", data=response.data
        )

    except Exception as e:

        raise HTTPException(500, str(e))


# =========================
# PROJECT REPORT
# =========================


def project_report():

    try:

        response = supabase_admin.table("projects").select("*").execute()

        return success_response(
            message="Project report fetched successfully", data=response.data
        )

    except Exception as e:

        raise HTTPException(500, str(e))


# =========================
# DASHBOARD REPORT
# =========================


def dashboard_report():

    try:

        employees = len(supabase_admin.table("employees").select("id").execute().data)

        attendance = len(supabase_admin.table("attendance").select("id").execute().data)

        leaves = len(supabase_admin.table("leave_requests").select("id").execute().data)

        payroll = len(supabase_admin.table("payroll").select("id").execute().data)

        projects = len(supabase_admin.table("projects").select("id").execute().data)

        return success_response(
            message="Dashboard report fetched successfully",
            data={
                "employees": employees,
                "attendance": attendance,
                "leaves": leaves,
                "payroll": payroll,
                "projects": projects,
            },
        )

    except Exception as e:

        raise HTTPException(500, str(e))
