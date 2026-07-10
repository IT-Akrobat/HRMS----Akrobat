from pydantic import BaseModel


class DashboardStats(BaseModel):

    total_employees: int

    present_today: int

    absent_today: int

    on_leave: int

    late_today: int

    total_departments: int

    total_locations: int

    total_shifts: int
