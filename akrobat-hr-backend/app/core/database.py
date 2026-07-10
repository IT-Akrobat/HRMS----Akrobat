from supabase import create_client

from app.core.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
