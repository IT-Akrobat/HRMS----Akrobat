# from fastapi import APIRouter, Depends, HTTPException, Request

# from app.auth.schemas import LoginRequest, MeEnvelope
# from app.auth.services import get_me, login_user
# from app.core.responses import success_response
# from app.core.security import get_current_user

# router = APIRouter(prefix="/auth", tags=["Authentication"])


# @router.post("/login")
# def login(data: LoginRequest, request: Request):

#     try:

#         response = login_user(data.email, data.password, request=request)

#         return {
#             "access_token": response.session.access_token,
#             "refresh_token": response.session.refresh_token,
#             "user_id": response.user.id,
#         }

#     except HTTPException:
#         raise

#     except Exception as e:

#         raise HTTPException(status_code=401, detail=str(e))


# @router.get("/me", response_model=MeEnvelope)
# def me(user=Depends(get_current_user)):
#     """
#     The frontend's single post-login call. Returns everything needed to
#     decide the redirect target and render the sidebar — role, permissions,
#     allowed modules, sidebar entries, and profile — so no role logic needs
#     to live in the frontend. See app/auth/services.get_me.
#     """

#     data = get_me(user)

#     return success_response(message="User profile fetched successfully.", data=data)
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.schemas import LoginRequest, MeEnvelope, RefreshRequest
from app.auth.services import get_me, login_user, refresh_user_session
from app.core.responses import success_response
from app.core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
def login(data: LoginRequest, request: Request):

    try:

        response = login_user(data.email, data.password, request=request)

        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user_id": response.user.id,
        }

    except HTTPException:
        raise

    except Exception as e:

        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh")
def refresh(data: RefreshRequest):
    """
    Exchanges a refresh_token (issued at login, stored client-side) for a
    new access_token — called by the frontend's apiClient whenever a
    request comes back 401 "Invalid or expired token.", instead of forcing
    a full re-login every time the ~1hr access token expires.
    """

    response = refresh_user_session(data.refresh_token)

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "user_id": response.user.id,
    }


@router.get("/me", response_model=MeEnvelope)
def me(user=Depends(get_current_user)):
    """
    The frontend's single post-login call. Returns everything needed to
    decide the redirect target and render the sidebar — role, permissions,
    allowed modules, sidebar entries, and profile — so no role logic needs
    to live in the frontend. See app/auth/services.get_me.
    """

    data = get_me(user)

    return success_response(message="User profile fetched successfully.", data=data)
