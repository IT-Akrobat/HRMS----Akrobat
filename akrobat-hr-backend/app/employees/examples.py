"""
Swagger "Try it out" examples for POST /employees, one per role.

Real, fixed ids from sql/011_team_leader_and_org_structure.sql are used
wherever possible (TEAM LEADER role, QUANTITY SURVEYING department, the
3 new designations) so those examples work as-is. Everything else
(SUPER ADMIN / HR ADMIN / MANAGER / EMPLOYEE role ids, and any
pre-existing department/designation) was created with a random
uuid_generate_v4() in the original seed, so there's no way to know it
ahead of time here — those fields are left as an obvious
REPLACE_WITH_... placeholder naming exactly what to look up and from
which GET endpoint, so it's a copy/paste job in Swagger rather than a
guessing game.
"""

TEAM_LEADER_ROLE_ID = "11111111-1111-1111-1111-111111111111"
QUANTITY_SURVEYING_DEPARTMENT_ID = "22222222-2222-2222-2222-222222222222"
QS_HEAD_OF_INSPECTION_DESIGNATION_ID = "33333333-3333-3333-3333-333333333333"
STOREMAN_DESIGNATION_ID = "33333333-3333-3333-3333-333333333334"
DRIVER_DESIGNATION_ID = "33333333-3333-3333-3333-333333333335"

CREATE_EMPLOYEE_EXAMPLES = {
    "super_admin_creates_super_admin": {
        "summary": "1. Owner creates another SUPER ADMIN",
        "description": (
            "Called by IT@akrobat.com.sg (or any existing Super Admin). "
            "Get the real role_id first: GET /roles -> find role_name == 'SUPER ADMIN'."
        ),
        "value": {
            "full_name": "Aarav Krishnan",
            "email": "aarav.krishnan@akrobat.com.sg",
            "password": "StrongPass123!",
            "role_id": "REPLACE_WITH_SUPER_ADMIN_ROLE_ID_FROM_GET_/roles",
            "employment_status": "Active",
        },
    },
    "super_admin_creates_hr_admin": {
        "summary": "2. Super Admin creates an HR ADMIN",
        "description": (
            "role_id: GET /roles -> role_name == 'HR ADMIN'. "
            "department_id: GET /departments -> department_name == 'HUMAN RESOURCE'. "
            "designation_id: GET /designations -> designation_name == 'ACCOUNTING PROGRAMMER' "
            "(the only HR-linked designation seeded so far)."
        ),
        "value": {
            "full_name": "Sarah Williams",
            "email": "sarah.williams@akrobat.com.sg",
            "password": "StrongPass123!",
            "department_id": "REPLACE_WITH_HUMAN_RESOURCE_DEPARTMENT_ID_FROM_GET_/departments",
            "designation_id": "REPLACE_WITH_ACCOUNTING_PROGRAMMER_DESIGNATION_ID_FROM_GET_/designations",
            "role_id": "REPLACE_WITH_HR_ADMIN_ROLE_ID_FROM_GET_/roles",
            "joining_date": "2026-07-08",
            "employment_status": "Active",
        },
    },
    "super_admin_or_hr_creates_manager": {
        "summary": "3. Super Admin / HR Admin creates a MANAGER",
        "description": (
            "role_id: GET /roles -> role_name == 'MANAGER'. "
            "department_id: GET /departments -> department_name == 'OPERATIONS'. "
            "designation_id: GET /designations -> designation_name == 'PROJECT MANAGER'."
        ),
        "value": {
            "full_name": "Priya Nair",
            "email": "priya.nair@akrobat.com.sg",
            "password": "StrongPass123!",
            "department_id": "REPLACE_WITH_OPERATIONS_DEPARTMENT_ID_FROM_GET_/departments",
            "designation_id": "REPLACE_WITH_PROJECT_MANAGER_DESIGNATION_ID_FROM_GET_/designations",
            "role_id": "REPLACE_WITH_MANAGER_ROLE_ID_FROM_GET_/roles",
            "joining_date": "2026-07-08",
            "employment_status": "Active",
        },
    },
    "manager_creates_team_leader": {
        "summary": "4. Super Admin / Manager creates a TEAM LEADER (TL)",
        "description": (
            "role_id and designation_id are already real, fixed ids from "
            "sql/011_team_leader_and_org_structure.sql -- only department_id "
            "needs to be looked up (GET /departments -> department_name == 'INSPECTION')."
        ),
        "value": {
            "full_name": "Karthik Subramaniam",
            "email": "karthik.s@akrobat.com.sg",
            "password": "StrongPass123!",
            "department_id": "REPLACE_WITH_INSPECTION_DEPARTMENT_ID_FROM_GET_/departments",
            "designation_id": QS_HEAD_OF_INSPECTION_DESIGNATION_ID,
            "role_id": TEAM_LEADER_ROLE_ID,
            "joining_date": "2026-07-08",
            "employment_status": "Active",
        },
    },
    "manager_creates_employee": {
        "summary": "5. Manager / HR Admin creates an EMPLOYEE",
        "description": (
            "role_id: GET /roles -> role_name == 'EMPLOYEE'. "
            "department_id: GET /departments -> department_name == 'PROCUREMENT AND LOGISTICS'. "
            "designation_id: GET /designations -> designation_name == "
            "'PROCUREMENT AND LOGISTICS EXECUTIVE'."
        ),
        "value": {
            "full_name": "John Doe",
            "email": "john.doe@akrobat.com.sg",
            "password": "StrongPass123!",
            "department_id": "REPLACE_WITH_PROCUREMENT_AND_LOGISTICS_DEPARTMENT_ID_FROM_GET_/departments",
            "designation_id": "REPLACE_WITH_PROCUREMENT_AND_LOGISTICS_EXECUTIVE_DESIGNATION_ID_FROM_GET_/designations",
            "role_id": "REPLACE_WITH_EMPLOYEE_ROLE_ID_FROM_GET_/roles",
            "joining_date": "2026-07-08",
            "employment_status": "Active",
        },
    },
}
