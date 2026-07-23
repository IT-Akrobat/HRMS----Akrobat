# from typing import Any, Optional

# from pydantic import BaseModel, EmailStr


# class LoginRequest(BaseModel):

#     email: EmailStr

#     password: str


# class SidebarItem(BaseModel):
#     key: str
#     label: str
#     icon: str
#     route: str


# class MeProfile(BaseModel):
#     """Employee-facing profile fields. None for accounts with no linked
#     employee record (e.g. a Vendor login) rather than erroring out."""

#     employee_id: Optional[str] = None
#     full_name: Optional[str] = None
#     phone: Optional[str] = None
#     profile_photo: Optional[str] = None
#     joining_date: Optional[str] = None
#     employment_status: Optional[str] = None


# class MeResponse(BaseModel):
#     id: str
#     name: str
#     email: Optional[EmailStr] = None

#     role: str
#     role_id: str

#     # Multi-tenant org isolation isn't built yet (single-company schema
#     # today — see REFACTOR_NOTES.md "Suggested order for the next pass").
#     # These are returned now, as null, so the frontend contract doesn't
#     # change shape once Organization/Branch/Team land; it just starts
#     # getting populated.
#     organization: Optional[Any] = None
#     branch: Optional[Any] = None
#     department: Optional[Any] = None

#     permissions: list[str]
#     allowed_modules: list[str]
#     sidebar: list[SidebarItem]

#     redirect_path: str

#     theme: str = "light"
#     profile: MeProfile


# class MeEnvelope(BaseModel):
#     success: bool = True
#     message: str
#     data: MeResponse
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):

    email: EmailStr

    password: str


class RefreshRequest(BaseModel):

    refresh_token: str


class ChangePasswordRequest(BaseModel):

    current_password: str

    # Mirrors the frontend's client-side check (Settings.jsx), but the
    # backend can't trust that check ran — enforce it here too.
    new_password: str = Field(min_length=8)


class SidebarItem(BaseModel):
    key: str
    label: str
    icon: str
    route: str


class MeProfile(BaseModel):
    """Employee-facing profile fields. None for accounts with no linked
    employee record (e.g. a Vendor login) rather than erroring out."""

    id: Optional[str] = None  # employees.id (internal UUID) — needed by the
    # frontend to call employee-scoped endpoints for the logged-in user,
    # e.g. GET /reports/employees/{id}/full ("My Profile" full report
    # download). Not to be confused with employee_id, the human-readable
    # code (e.g. EMP-0042).
    employee_id: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None
    joining_date: Optional[str] = None
    employment_status: Optional[str] = None


class MeResponse(BaseModel):
    id: str
    name: str
    email: Optional[EmailStr] = None

    role: str
    role_id: str

    # Multi-tenant org isolation isn't built yet (single-company schema
    # today — see REFACTOR_NOTES.md "Suggested order for the next pass").
    # These are returned now, as null, so the frontend contract doesn't
    # change shape once Organization/Branch/Team land; it just starts
    # getting populated.
    organization: Optional[Any] = None
    branch: Optional[Any] = None
    department: Optional[Any] = None

    permissions: list[str]
    allowed_modules: list[str]
    sidebar: list[SidebarItem]

    redirect_path: str

    theme: str = "light"
    profile: MeProfile


class MeEnvelope(BaseModel):
    success: bool = True
    message: str
    data: MeResponse
