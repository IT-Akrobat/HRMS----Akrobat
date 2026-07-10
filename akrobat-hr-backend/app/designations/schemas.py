from pydantic import BaseModel


class CreateDesignationRequest(BaseModel):

    designation_name: str

    department_id: str
