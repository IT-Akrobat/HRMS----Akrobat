from datetime import date

from fastapi import HTTPException

from app.core.database import supabase_admin


# =========================
# EMPLOYEE REPORT
# =========================

def employee_report():

    try:

        response = supabase_admin.table(
            "employees"
        ).select(
            """
            *,
            departments(name),
            designations(name),
            roles(name)
            """
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )


# =========================
# ATTENDANCE REPORT
# =========================

def attendance_report():

    try:

        response = supabase_admin.table(
            "attendance"
        ).select(
            """
            *,
            employees(
                full_name,
                employee_id
            )
            """
        ).order(
            "attendance_date",
            desc=True
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )


# =========================
# TODAY ATTENDANCE
# =========================

def today_attendance():

    try:

        today = str(date.today())

        response = supabase_admin.table(
            "attendance"
        ).select(
            """
            *,
            employees(
                full_name,
                employee_id
            )
            """
        ).eq(
            "attendance_date",
            today
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )


# =========================
# LEAVE REPORT
# =========================

def leave_report():

    try:

        response = supabase_admin.table(
            "leaves"
        ).select(
            """
            *,
            employees(
                full_name,
                employee_id
            )
            """
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )


# =========================
# PAYROLL REPORT
# =========================

def payroll_report():

    try:

        response = supabase_admin.table(
            "payroll"
        ).select(
            """
            *,
            employees(
                full_name,
                employee_id
            )
            """
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )


# =========================
# PROJECT REPORT
# =========================

def project_report():

    try:

        response = supabase_admin.table(
            "projects"
        ).select(
            "*"
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )


# =========================
# DASHBOARD REPORT
# =========================

def dashboard_report():

    try:

        employees = len(
            supabase_admin.table(
                "employees"
            ).select(
                "id"
            ).execute().data
        )

        attendance = len(
            supabase_admin.table(
                "attendance"
            ).select(
                "id"
            ).execute().data
        )

        leaves = len(
            supabase_admin.table(
                "leaves"
            ).select(
                "id"
            ).execute().data
        )

        payroll = len(
            supabase_admin.table(
                "payroll"
            ).select(
                "id"
            ).execute().data
        )

        projects = len(
            supabase_admin.table(
                "projects"
            ).select(
                "id"
            ).execute().data
        )

        return {

            "employees": employees,

            "attendance": attendance,

            "leaves": leaves,

            "payroll": payroll,

            "projects": projects

        }

    except Exception as e:

        raise HTTPException(
            500,
            str(e)
        )
