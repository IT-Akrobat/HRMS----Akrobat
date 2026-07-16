# from typing import Optional

# from fastapi import HTTPException, Request

# from app.core.database import supabase_admin
# from app.core.repository import SupabaseRepository
# from app.core.responses import success_response
# from app.core.logger import logger
# from app.core.exceptions import internal_server_error, conflict
# from app.core.messages import EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_DELETED
# from app.core.helpers.employee_helper import (
#     generate_employee_id,
#     validate_company_email,
#     check_email_exists,
#     validate_reference,
#     get_employee_or_404,
# )
# from app.core.audit import record_audit_log

# employee_repo = SupabaseRepository("employees")

# EMPLOYEE_LIST_SELECT = """
#     *,
#     departments(id, department_name),
#     designations(id, designation_name),
#     shifts(id, shift_name)
# """


# # ==========================================
# # GET EMPLOYEES
# # ==========================================


# def get_employees(
#     department_id: Optional[str] = None,
#     designation_id: Optional[str] = None,
#     role_id: Optional[str] = None,
# ):
#     try:
#         employees, _total = employee_repo.list(
#             select=EMPLOYEE_LIST_SELECT,
#             filters={
#                 "department_id": department_id,
#                 "designation_id": designation_id,
#             },
#         )

#         if role_id:
#             profiles = (
#                 supabase_admin.table("user_profiles")
#                 .select("employee_id")
#                 .eq("role_id", role_id)
#                 .execute()
#             )

#             employee_ids = {row["employee_id"] for row in profiles.data}

#             employees = [emp for emp in employees if emp["id"] in employee_ids]

#         return success_response(
#             message="Employees fetched successfully.",
#             data=employees,
#         )

#     except HTTPException:
#         raise

#     except Exception as e:
#         logger.exception(e)
#         internal_server_error("Unable to fetch employees.")


# # ==========================================
# # CREATE EMPLOYEE
# # ==========================================


# def create_employee(data, current_user=None, request: Optional[Request] = None):

#     auth_user_id = None

#     try:
#         validate_company_email(data.email)
#         check_email_exists(data.email)

#         validate_reference("departments", data.department_id, "Department")
#         validate_reference("designations", data.designation_id, "Designation")
#         validate_reference("shifts", data.shift_id, "Shift")
#         validate_reference("roles", data.role_id, "Role")
#         validate_reference("employees", data.manager_id, "Manager")

#         auth_user = supabase_admin.auth.admin.create_user(
#             {
#                 "email": data.email,
#                 "password": data.password,
#                 "email_confirm": True,
#             }
#         )

#         auth_user_id = auth_user.user.id

#         employee_data = employee_repo.create(
#             {
#                 "employee_id": generate_employee_id(),
#                 "full_name": data.full_name,
#                 "email": data.email,
#                 "phone": data.phone,
#                 "department_id": (
#                     str(data.department_id) if data.department_id else None
#                 ),
#                 "designation_id": (
#                     str(data.designation_id) if data.designation_id else None
#                 ),
#                 "manager_id": str(data.manager_id) if data.manager_id else None,
#                 "joining_date": str(data.joining_date) if data.joining_date else None,
#                 "employment_status": data.employment_status,
#                 "work_location": data.work_location,
#                 "shift_id": str(data.shift_id) if data.shift_id else None,
#                 "profile_photo": data.profile_photo,
#             }
#         )

#         supabase_admin.table("user_profiles").insert(
#             {
#                 "auth_user_id": auth_user_id,
#                 "employee_id": employee_data["id"],
#                 "role_id": str(data.role_id),
#             }
#         ).execute()

#         record_audit_log(
#             module="EMPLOYEE",
#             action="CREATE",
#             performed_by=getattr(current_user, "id", None),
#             target_employee_id=employee_data["id"],
#             record_id=employee_data["id"],
#             description=f"{employee_data['full_name']} created",
#             new_values=employee_data,
#             request=request,
#         )

#         return success_response(
#             message=EMPLOYEE_CREATED,
#             data=employee_data,
#         )

#     except HTTPException:
#         # Roll back the auth user so we don't leak logins for employees
#         # that failed to persist.
#         if auth_user_id:
#             try:
#                 supabase_admin.auth.admin.delete_user(auth_user_id)
#             except Exception as rollback_error:
#                 logger.exception(rollback_error)
#         raise

#     except Exception as e:
#         logger.exception(e)

#         if auth_user_id:
#             try:
#                 supabase_admin.auth.admin.delete_user(auth_user_id)
#             except Exception as rollback_error:
#                 logger.exception(rollback_error)

#         internal_server_error("Unable to create employee.")


# # ==========================================
# # UPDATE EMPLOYEE
# # ==========================================


# def update_employee(
#     employee_id: str,
#     data,
#     current_user=None,
#     request: Optional[Request] = None,
# ):
#     try:
#         existing_employee = get_employee_or_404(employee_id)

#         update_data = data.model_dump(exclude_unset=True)

#         if "email" in update_data and update_data["email"]:
#             validate_company_email(update_data["email"])

#             if (
#                 employee_repo.find_one({"email": update_data["email"]}) not in (None,)
#                 and employee_repo.find_one({"email": update_data["email"]}).get("id")
#                 != employee_id
#             ):
#                 conflict("Email already exists.")

#         if "department_id" in update_data:
#             validate_reference(
#                 "departments", update_data["department_id"], "Department"
#             )

#         if "role_id" in update_data:
#             validate_reference("roles", update_data["role_id"], "Role")

#             supabase_admin.table("user_profiles").update(
#                 {"role_id": str(update_data["role_id"])}
#             ).eq("employee_id", employee_id).execute()

#             update_data.pop("role_id")

#         if "designation_id" in update_data:
#             validate_reference(
#                 "designations", update_data["designation_id"], "Designation"
#             )

#         if "shift_id" in update_data:
#             validate_reference("shifts", update_data["shift_id"], "Shift")

#         if "manager_id" in update_data:
#             validate_reference("employees", update_data["manager_id"], "Manager")

#         # UUID fields must be stringified for the Supabase client.
#         for key in ("department_id", "designation_id", "shift_id", "manager_id"):
#             if key in update_data and update_data[key] is not None:
#                 update_data[key] = str(update_data[key])

#         for key in ("joining_date",):
#             if key in update_data and update_data[key] is not None:
#                 update_data[key] = str(update_data[key])

#         updated_employee = employee_repo.update(employee_id, update_data)

#         record_audit_log(
#             module="EMPLOYEE",
#             action="UPDATE",
#             performed_by=getattr(current_user, "id", None),
#             target_employee_id=employee_id,
#             record_id=employee_id,
#             description=f"{updated_employee['full_name']} updated",
#             old_values=existing_employee,
#             new_values=updated_employee,
#             request=request,
#         )

#         return success_response(
#             message=EMPLOYEE_UPDATED,
#             data=updated_employee,
#         )

#     except HTTPException:
#         raise

#     except Exception as e:
#         logger.exception(e)
#         internal_server_error("Unable to update employee.")


# # ==========================================
# # DELETE EMPLOYEE
# # ==========================================


# def delete_employee(
#     employee_id: str,
#     current_user=None,
#     request: Optional[Request] = None,
# ):
#     try:
#         employee = get_employee_or_404(employee_id)

#         profile = (
#             supabase_admin.table("user_profiles")
#             .select("id,auth_user_id")
#             .eq("employee_id", employee_id)
#             .maybe_single()
#             .execute()
#         )

#         if profile and profile.data:
#             try:
#                 supabase_admin.auth.admin.delete_user(profile.data["auth_user_id"])
#             except Exception:
#                 logger.warning("Unable to delete auth user.")

#             supabase_admin.table("user_profiles").delete().eq(
#                 "employee_id", employee_id
#             ).execute()

#         employee_repo.delete(employee_id)

#         record_audit_log(
#             module="EMPLOYEE",
#             action="DELETE",
#             performed_by=getattr(current_user, "id", None),
#             target_employee_id=employee_id,
#             record_id=employee_id,
#             description=f"{employee['full_name']} deleted",
#             old_values=employee,
#             request=request,
#         )

#         return success_response(message=EMPLOYEE_DELETED)

#     except HTTPException:
#         raise

#     except Exception as e:
#         logger.exception(e)
#         internal_server_error("Unable to delete employee.")
from typing import Optional

from fastapi import HTTPException, Request

from app.core.database import supabase_admin
from app.core.repository import SupabaseRepository
from app.core.responses import success_response
from app.core.logger import logger
from app.core.exceptions import internal_server_error, conflict
from app.core.messages import EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_DELETED
from app.core.helpers.employee_helper import (
    generate_employee_id,
    validate_company_email,
    check_email_exists,
    validate_reference,
    get_employee_or_404,
)
from app.core.audit import record_audit_log

employee_repo = SupabaseRepository("employees")

EMPLOYEE_LIST_SELECT = """
    *,
    departments!employees_department_id_fkey(id, department_name),
    designations(id, designation_name),
    shifts(id, shift_name)
"""


# ==========================================
# GET EMPLOYEES
# ==========================================


def get_employees(
    department_id: Optional[str] = None,
    designation_id: Optional[str] = None,
    role_id: Optional[str] = None,
):
    try:
        employees, _total = employee_repo.list(
            select=EMPLOYEE_LIST_SELECT,
            filters={
                "department_id": department_id,
                "designation_id": designation_id,
            },
        )

        if role_id:
            profiles = (
                supabase_admin.table("user_profiles")
                .select("employee_id")
                .eq("role_id", role_id)
                .execute()
            )

            employee_ids = {row["employee_id"] for row in profiles.data}

            employees = [emp for emp in employees if emp["id"] in employee_ids]

        return success_response(
            message="Employees fetched successfully.",
            data=employees,
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to fetch employees.")


# ==========================================
# CREATE EMPLOYEE
# ==========================================


def create_employee(data, current_user=None, request: Optional[Request] = None):

    auth_user_id = None

    try:
        validate_company_email(data.email)
        check_email_exists(data.email)

        validate_reference("departments", data.department_id, "Department")
        validate_reference("designations", data.designation_id, "Designation")
        validate_reference("shifts", data.shift_id, "Shift")
        validate_reference("roles", data.role_id, "Role")
        validate_reference("employees", data.manager_id, "Manager")

        auth_user = supabase_admin.auth.admin.create_user(
            {
                "email": data.email,
                "password": data.password,
                "email_confirm": True,
            }
        )

        auth_user_id = auth_user.user.id

        employee_data = employee_repo.create(
            {
                "employee_id": generate_employee_id(),
                "full_name": data.full_name,
                "email": data.email,
                "phone": data.phone,
                "department_id": (
                    str(data.department_id) if data.department_id else None
                ),
                "designation_id": (
                    str(data.designation_id) if data.designation_id else None
                ),
                "manager_id": str(data.manager_id) if data.manager_id else None,
                "joining_date": str(data.joining_date) if data.joining_date else None,
                "date_of_birth": (
                    str(data.date_of_birth) if data.date_of_birth else None
                ),
                "employment_status": data.employment_status,
                "work_location": data.work_location,
                "shift_id": str(data.shift_id) if data.shift_id else None,
                "profile_photo": data.profile_photo,
            }
        )

        supabase_admin.table("user_profiles").insert(
            {
                "auth_user_id": auth_user_id,
                "employee_id": employee_data["id"],
                "role_id": str(data.role_id),
            }
        ).execute()

        record_audit_log(
            module="EMPLOYEE",
            action="CREATE",
            performed_by=getattr(current_user, "id", None),
            target_employee_id=employee_data["id"],
            record_id=employee_data["id"],
            description=f"{employee_data['full_name']} created",
            new_values=employee_data,
            request=request,
        )

        return success_response(
            message=EMPLOYEE_CREATED,
            data=employee_data,
        )

    except HTTPException:
        # Roll back the auth user so we don't leak logins for employees
        # that failed to persist.
        if auth_user_id:
            try:
                supabase_admin.auth.admin.delete_user(auth_user_id)
            except Exception as rollback_error:
                logger.exception(rollback_error)
        raise

    except Exception as e:
        logger.exception(e)

        if auth_user_id:
            try:
                supabase_admin.auth.admin.delete_user(auth_user_id)
            except Exception as rollback_error:
                logger.exception(rollback_error)

        internal_server_error("Unable to create employee.")


# ==========================================
# UPDATE EMPLOYEE
# ==========================================


def update_employee(
    employee_id: str,
    data,
    current_user=None,
    request: Optional[Request] = None,
):
    try:
        existing_employee = get_employee_or_404(employee_id)

        update_data = data.model_dump(exclude_unset=True)

        if "email" in update_data and update_data["email"]:
            validate_company_email(update_data["email"])

            if (
                employee_repo.find_one({"email": update_data["email"]}) not in (None,)
                and employee_repo.find_one({"email": update_data["email"]}).get("id")
                != employee_id
            ):
                conflict("Email already exists.")

        if "department_id" in update_data:
            validate_reference(
                "departments", update_data["department_id"], "Department"
            )

        if "role_id" in update_data:
            validate_reference("roles", update_data["role_id"], "Role")

            supabase_admin.table("user_profiles").update(
                {"role_id": str(update_data["role_id"])}
            ).eq("employee_id", employee_id).execute()

            update_data.pop("role_id")

        if "designation_id" in update_data:
            validate_reference(
                "designations", update_data["designation_id"], "Designation"
            )

        if "shift_id" in update_data:
            validate_reference("shifts", update_data["shift_id"], "Shift")

        if "manager_id" in update_data:
            validate_reference("employees", update_data["manager_id"], "Manager")

        # UUID fields must be stringified for the Supabase client.
        for key in ("department_id", "designation_id", "shift_id", "manager_id"):
            if key in update_data and update_data[key] is not None:
                update_data[key] = str(update_data[key])

        for key in ("joining_date", "date_of_birth"):
            if key in update_data and update_data[key] is not None:
                update_data[key] = str(update_data[key])

        updated_employee = employee_repo.update(employee_id, update_data)

        record_audit_log(
            module="EMPLOYEE",
            action="UPDATE",
            performed_by=getattr(current_user, "id", None),
            target_employee_id=employee_id,
            record_id=employee_id,
            description=f"{updated_employee['full_name']} updated",
            old_values=existing_employee,
            new_values=updated_employee,
            request=request,
        )

        return success_response(
            message=EMPLOYEE_UPDATED,
            data=updated_employee,
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to update employee.")


# ==========================================
# DELETE EMPLOYEE
# ==========================================


def delete_employee(
    employee_id: str,
    current_user=None,
    request: Optional[Request] = None,
):
    try:
        employee = get_employee_or_404(employee_id)

        profile = (
            supabase_admin.table("user_profiles")
            .select("id,auth_user_id")
            .eq("employee_id", employee_id)
            .maybe_single()
            .execute()
        )

        if profile and profile.data:
            try:
                supabase_admin.auth.admin.delete_user(profile.data["auth_user_id"])
            except Exception:
                logger.warning("Unable to delete auth user.")

            supabase_admin.table("user_profiles").delete().eq(
                "employee_id", employee_id
            ).execute()

        employee_repo.delete(employee_id)

        record_audit_log(
            module="EMPLOYEE",
            action="DELETE",
            performed_by=getattr(current_user, "id", None),
            target_employee_id=employee_id,
            record_id=employee_id,
            description=f"{employee['full_name']} deleted",
            old_values=employee,
            request=request,
        )

        return success_response(message=EMPLOYEE_DELETED)

    except HTTPException:
        raise

    except Exception as e:
        logger.exception(e)
        internal_server_error("Unable to delete employee.")
