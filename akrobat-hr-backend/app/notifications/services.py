from fastapi import HTTPException

from app.core.database import supabase_admin


# =========================
# CREATE NOTIFICATION
# =========================

def create_notification(data):

    try:

        response = supabase_admin.table(
            "notifications"
        ).insert(

            {
                "employee_id": str(data.employee_id),
                "title": data.title,
                "message": data.message,
                "notification_type": data.notification_type
            }

        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)[0]

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================
# GET ALL NOTIFICATIONS
# =========================

def get_notifications():

    try:

        response = supabase_admin.table(
            "notifications"
        ).select(
            """
            *,
            employees(
                id,
                full_name,
                employee_id
            )
            """
        ).order(
            "created_at",
            desc=True
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================
# GET EMPLOYEE NOTIFICATIONS
# =========================

def get_employee_notifications(employee_id: str):

    try:

        response = supabase_admin.table(
            "notifications"
        ).select(
            "*"
        ).eq(
            "employee_id",
            employee_id
        ).order(
            "created_at",
            desc=True
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================
# GET SINGLE NOTIFICATION
# =========================

def get_notification(notification_id: str):

    try:

        response = supabase_admin.table(
            "notifications"
        ).select(
            "*"
        ).eq(
            "id",
            notification_id
        ).single().execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            status_code=404,
            detail=str(e)
        )


# =========================
# UPDATE NOTIFICATION
# =========================

def update_notification(
    notification_id: str,
    data: dict
):

    try:

        response = supabase_admin.table(
            "notifications"
        ).update(
            data
        ).eq(
            "id",
            notification_id
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)[0]

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================
# MARK AS READ
# =========================

def mark_as_read(notification_id: str):

    try:

        response = supabase_admin.table(
            "notifications"
        ).update(

            {
                "is_read": True
            }

        ).eq(
            "id",
            notification_id
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)[0]

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================
# DELETE NOTIFICATION
# =========================

def delete_notification(notification_id: str):

    try:

        supabase_admin.table(
            "notifications"
        ).delete().eq(
            "id",
            notification_id
        ).execute()

        return {
            "message": "Notification deleted successfully"
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================
# BROADCAST NOTIFICATION
# =========================

def broadcast_notification(data):

    try:

        employees = supabase_admin.table(
            "employees"
        ).select(
            "id"
        ).execute()

        notifications = []

        for employee in employees.data:

            notifications.append(

                {
                    "employee_id": employee["id"],
                    "title": data.title,
                    "message": data.message,
                    "notification_type": data.notification_type
                }

            )

        response = supabase_admin.table(
            "notifications"
        ).insert(
            notifications
        ).execute()

        return success_response(

    message=EMPLOYEE_CREATED,

    data=response.data[0]

)

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
