import random

from app.core.database import supabase_admin
from app.core.exceptions import (
    bad_request,
    conflict,
    not_found,
)
from app.core.constants import *

ALLOWED_DOMAIN = "akrobat.com.sg"


# ==========================================
# GENERATE EMPLOYEE ID
# ==========================================


def generate_employee_id() -> str:

    while True:

        employee_id = f"AKR-{random.randint(10000,99999)}"

        response = (
            supabase_admin.table("employees")
            .select("id")
            .eq("employee_id", employee_id)
            .execute()
        )

        if not response.data:
            return employee_id


# ==========================================
# VALIDATE COMPANY EMAIL
# ==========================================


def validate_company_email(email: str):

    if not email:
        bad_request("Email is required.")

    if not email.lower().endswith(f"@{ALLOWED_DOMAIN}"):
        bad_request(f"Only @{ALLOWED_DOMAIN} email is allowed.")


# ==========================================
# CHECK EMAIL EXISTS
# ==========================================


def check_email_exists(email: str, exclude_employee_id: str | None = None):

    query = supabase_admin.table("employees").select("id").eq("email", email)

    if exclude_employee_id:
        query = query.neq("id", exclude_employee_id)

    response = query.execute()

    if response.data:
        conflict("Email already exists.")


# ==========================================
# VALIDATE FOREIGN KEY
# ==========================================


def validate_reference(
    table_name: str,
    record_id: str | None,
    field_name: str,
):

    if not record_id:
        return

    response = (
        supabase_admin.table(table_name).select("id").eq("id", record_id).execute()
    )

    if not response.data:
        not_found(f"{field_name} not found.")


# ==========================================
# RESOLVE DEFAULT SHIFT FROM DESIGNATION
# ==========================================


def resolve_default_shift_id(designation_id: str | None) -> str | None:
    """
    "When creating a user, their working hours should be mentioned" —
    every designation is seeded with a `default_shift_id` (see
    sql/014_designation_shifts_and_site_visits.sql) matching the real
    Attendance Info doc (Office / Operation Site / Inspection Site /
    Work Shop hours). Called by create_employee() ONLY when the caller
    didn't explicitly pass a shift_id, so HR can still hand-pick a
    different shift (e.g. the 9-6 Office variant) per employee — this
    is a suggestion/default, not a hard rule.
    """

    if not designation_id:
        return None

    response = (
        supabase_admin.table("designations")
        .select("default_shift_id")
        .eq("id", designation_id)
        .maybe_single()
        .execute()
    )

    if not response or not response.data:
        return None

    return response.data.get("default_shift_id")


# ==========================================
# GET EMPLOYEE
# ==========================================


def get_employee_or_404(employee_id: str):

    response = (
        supabase_admin.table("employees")
        .select("*")
        .eq("id", employee_id)
        .single()
        .execute()
    )

    if not response.data:
        not_found("Employee not found.")

    return response.data


# ==========================================
# GET EMPLOYEE ID FOR AUTH USER
# ==========================================


def get_employee_id_for_auth_user(auth_user_id: str) -> str | None:
    """
    Reverse lookup of get_user_profile: given the Supabase auth user id
    (what `get_current_user` returns as `user.id`), find the employee_id
    it's linked to. Used for self-service endpoints (e.g. "my payroll",
    "my documents") and for ownership checks — is this record the
    caller's own, regardless of what role/permission they hold.
    """

    response = (
        supabase_admin.table("user_profiles")
        .select("employee_id")
        .eq("auth_user_id", auth_user_id)
        .maybe_single()
        .execute()
    )

    if not response or not response.data:
        return None

    return response.data.get("employee_id")


# ==========================================
# GET ALL EMPLOYEE IDS FOR A GIVEN ROLE
# ==========================================


def get_employee_ids_for_role(role_name: str) -> list[str]:
    """
    Every employee (with a linked user_profiles row) whose role matches
    `role_name`, e.g. "SUPER ADMIN". Used to fan a notification out to
    everyone who holds a role, rather than a single hardcoded/derived
    person — see notify_employee() call sites in app/leaves/services.py.
    Returns [] (never raises) if the lookup fails for any reason, since
    callers treat notifications as best-effort.
    """

    try:
        response = (
            supabase_admin.table("user_profiles")
            .select("employee_id, roles!inner(role_name)")
            .eq("roles.role_name", role_name)
            .execute()
        )

        return [
            row["employee_id"]
            for row in (response.data or [])
            if row.get("employee_id")
        ]

    except Exception:
        return []


# ==========================================
# GET USER PROFILE
# ==========================================


# ==========================================
# MANAGER HIERARCHY (direct + indirect reports)
# ==========================================


def get_manager_chain(employee_id: str, max_depth: int = 10) -> list[str]:
    """
    Walks up `employees.manager_id` starting from `employee_id`, returning
    the ids of every manager above them (direct manager first). Stops at
    the top of the org chart or after `max_depth` hops (guards against a
    bad/circular manager_id causing an infinite loop).

    Used for ownership checks like "is this caller the direct or indirect
    manager of this employee" — e.g. leave/overtime approval — without
    hardcoding a role check.
    """

    chain: list[str] = []
    current_id = employee_id

    for _ in range(max_depth):
        response = (
            supabase_admin.table("employees")
            .select("manager_id")
            .eq("id", current_id)
            .maybe_single()
            .execute()
        )

        if not response or not response.data:
            break

        manager_id = response.data.get("manager_id")

        if not manager_id or manager_id in chain:
            break

        chain.append(manager_id)
        current_id = manager_id

    return chain


def is_manager_of(manager_employee_id: str | None, employee_id: str | None) -> bool:
    """True if manager_employee_id is the direct or indirect manager of employee_id."""

    if not manager_employee_id or not employee_id:
        return False

    return manager_employee_id in get_manager_chain(employee_id)


def get_all_report_ids(manager_employee_id: str, max_depth: int = 10) -> list[str]:
    """
    Returns the ids of every direct + indirect report of manager_employee_id
    (i.e. every employee whose manager chain includes manager_employee_id),
    via breadth-first traversal down the org chart.
    """

    all_report_ids: set[str] = set()
    frontier = [manager_employee_id]

    for _ in range(max_depth):
        if not frontier:
            break

        response = (
            supabase_admin.table("employees")
            .select("id")
            .in_("manager_id", frontier)
            .execute()
        )

        rows = response.data or []
        new_ids = [row["id"] for row in rows if row["id"] not in all_report_ids]

        if not new_ids:
            break

        all_report_ids.update(new_ids)
        frontier = new_ids

    return list(all_report_ids)


# ==========================================
# FIELD STAFF (multi-site Inspection / Operation employees)
# ==========================================


def get_field_employee_ids() -> set[str]:
    """
    Ids of every employee whose designation sits under an
    INSPECTION*/OPERATION* department — the staff who visit multiple
    sites in a day and therefore get the Site Visits UI, as opposed to a
    single fixed office/desk. Derived from department rather than a
    dedicated boolean column, since department is already the source of
    truth (see sql/014_designation_shifts_and_site_visits.sql) and the
    set of "field" departments may grow later without a schema change.
    Returns an empty set (never raises) — callers treat this as
    best-effort, same convention as get_employee_ids_for_role().
    """

    try:
        dept_response = (
            supabase_admin.table("departments").select("id, department_name").execute()
        )
        field_dept_ids = [
            d["id"]
            for d in (dept_response.data or [])
            if (d.get("department_name") or "")
            .upper()
            .startswith(("INSPECTION", "OPERATION"))
        ]

        if not field_dept_ids:
            return set()

        desig_response = (
            supabase_admin.table("designations")
            .select("id")
            .in_("department_id", field_dept_ids)
            .execute()
        )
        field_desig_ids = [d["id"] for d in (desig_response.data or [])]

        if not field_desig_ids:
            return set()

        emp_response = (
            supabase_admin.table("employees")
            .select("id")
            .in_("designation_id", field_desig_ids)
            .execute()
        )

        return {e["id"] for e in (emp_response.data or [])}

    except Exception:
        return set()


def is_field_employee(employee_id: str | None) -> bool:
    """Convenience single-employee check built on get_field_employee_ids()."""

    if not employee_id:
        return False

    return employee_id in get_field_employee_ids()


def get_user_profile(employee_id: str):

    response = (
        supabase_admin.table("user_profiles")
        .select("*")
        .eq("employee_id", employee_id)
        .execute()
    )

    return response.data[0] if response.data else None
