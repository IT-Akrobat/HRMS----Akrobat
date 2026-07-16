# from datetime import date, datetime
# from typing import Optional
# from uuid import UUID

# from pydantic import BaseModel, ConfigDict, EmailStr, Field

# from app.core.constants import ACTIVE

# # ==========================================
# # Create Employee
# # ==========================================


# class EmployeeCreate(BaseModel):
#     model_config = ConfigDict(extra="forbid")

#     full_name: str = Field(..., min_length=2, max_length=100)

#     email: EmailStr

#     password: str = Field(..., min_length=8, max_length=100)

#     phone: Optional[str] = Field(default=None, max_length=20)

#     department_id: Optional[UUID] = None
#     designation_id: Optional[UUID] = None
#     manager_id: Optional[UUID] = None
#     shift_id: Optional[UUID] = None

#     role_id: UUID

#     joining_date: Optional[date] = None

#     employment_status: str = ACTIVE

#     work_location: Optional[str] = Field(default=None, max_length=150)

#     profile_photo: Optional[str] = None


# # ==========================================
# # Update Employee
# # ==========================================


# class EmployeeUpdate(BaseModel):
#     model_config = ConfigDict(extra="forbid")

#     full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)

#     email: Optional[EmailStr] = None

#     phone: Optional[str] = Field(default=None, max_length=20)

#     department_id: Optional[UUID] = None
#     designation_id: Optional[UUID] = None
#     manager_id: Optional[UUID] = None
#     shift_id: Optional[UUID] = None

#     joining_date: Optional[date] = None

#     employment_status: Optional[str] = None

#     work_location: Optional[str] = Field(default=None, max_length=150)

#     profile_photo: Optional[str] = None


# # ==========================================
# # Employee Response
# # ==========================================


# class EmployeeResponse(BaseModel):
#     model_config = ConfigDict(from_attributes=True)

#     id: UUID
#     employee_id: str
#     full_name: str

#     email: Optional[str]
#     phone: Optional[str]

#     department_id: Optional[UUID]
#     designation_id: Optional[UUID]
#     manager_id: Optional[UUID]
#     shift_id: Optional[UUID]

#     joining_date: Optional[date]

#     employment_status: str

#     work_location: Optional[str]
#     profile_photo: Optional[str]

#     created_at: Optional[datetime]
#     updated_at: Optional[datetime]


# # ==========================================
# # Employee List Response
# # ==========================================


# class EmployeeListResponse(BaseModel):
#     employees: list[EmployeeResponse]
#     total: int


# # ==========================================
# # Employee Filter
# # ==========================================


# class EmployeeFilter(BaseModel):
#     department_id: Optional[UUID] = None
#     designation_id: Optional[UUID] = None
#     role_id: Optional[UUID] = None
#     employment_status: Optional[str] = None
#     search: Optional[str] = None
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.constants import ACTIVE

# ==========================================
# Create Employee
# ==========================================


class EmployeeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(..., min_length=2, max_length=100)

    email: EmailStr

    password: str = Field(..., min_length=8, max_length=100)

    phone: Optional[str] = Field(default=None, max_length=20)

    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    shift_id: Optional[UUID] = None

    role_id: UUID

    joining_date: Optional[date] = None

    date_of_birth: Optional[date] = None

    employment_status: str = ACTIVE

    work_location: Optional[str] = Field(default=None, max_length=150)

    profile_photo: Optional[str] = None


# ==========================================
# Update Employee
# ==========================================


class EmployeeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(default=None, max_length=20)

    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    shift_id: Optional[UUID] = None

    joining_date: Optional[date] = None

    date_of_birth: Optional[date] = None

    employment_status: Optional[str] = None

    work_location: Optional[str] = Field(default=None, max_length=150)

    profile_photo: Optional[str] = None


# ==========================================
# Employee Response
# ==========================================


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    employee_id: str
    full_name: str

    email: Optional[str]
    phone: Optional[str]

    department_id: Optional[UUID]
    designation_id: Optional[UUID]
    manager_id: Optional[UUID]
    shift_id: Optional[UUID]

    joining_date: Optional[date]

    date_of_birth: Optional[date] = None

    employment_status: str

    work_location: Optional[str]
    profile_photo: Optional[str]

    created_at: Optional[datetime]
    updated_at: Optional[datetime]


# ==========================================
# Employee List Response
# ==========================================


class EmployeeListResponse(BaseModel):
    employees: list[EmployeeResponse]
    total: int


# ==========================================
# Employee Filter
# ==========================================


class EmployeeFilter(BaseModel):
    department_id: Optional[UUID] = None
    designation_id: Optional[UUID] = None
    role_id: Optional[UUID] = None
    employment_status: Optional[str] = None
    search: Optional[str] = None
