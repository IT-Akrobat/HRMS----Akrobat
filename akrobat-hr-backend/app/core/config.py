import os

from dotenv import load_dotenv

load_dotenv()


def get_env(key: str, default: str | None = None):
    value = os.getenv(key, default)

    if value is None:
        raise ValueError(f"Missing environment variable: {key}")

    return value


SUPABASE_URL = get_env("SUPABASE_URL")

SUPABASE_ANON_KEY = get_env("SUPABASE_ANON_KEY")

SUPABASE_SERVICE_ROLE_KEY = get_env("SUPABASE_SERVICE_ROLE_KEY")

SUPABASE_JWT_SECRET = get_env("SUPABASE_JWT_SECRET")

APP_NAME = os.getenv("APP_NAME", "Akrobat HRMS")

APP_VERSION = os.getenv("APP_VERSION", "1.0.0")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
