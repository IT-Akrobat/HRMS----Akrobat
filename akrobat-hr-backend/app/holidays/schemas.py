from pydantic import BaseModel
from datetime import date


class CreateHolidayRequest(BaseModel):
    holiday_name: str
    holiday_date: date
    description: str | None = None
