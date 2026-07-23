import threading

from supabase import create_client

from app.core.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY


class _ThreadLocalSupabaseClient:
    """
    supabase-py's client keeps a single shared httpx.Client for connection
    pooling. FastAPI runs our sync `def` route handlers in a worker thread
    pool, so when a page fires several requests at once (e.g. the employees
    page loading departments/designations/shifts/roles/employees together),
    multiple threads can hit that one shared httpx.Client at the same
    moment. httpcore's internal connection pool isn't safe against that —
    one thread can end up mutating it while another is iterating it, which
    surfaces as:

        RuntimeError: deque mutated during iteration

    A previous fix serialized every request behind a single lock, which
    removed the crash but made concurrent requests queue up one-by-one
    (visibly slow — each request waiting on the last). Instead, give each
    worker thread its own real Supabase client (built lazily the first time
    that thread needs one, then reused for that thread's lifetime). Threads
    then never share connection-pool state with each other, so the race is
    gone and requests stay concurrent. No call sites elsewhere need to
    change — they just keep doing `supabase_admin.table(...)...execute()`.
    """

    def __init__(self, url, key):
        self._url = url
        self._key = key
        self._local = threading.local()

    def _get(self):
        client = getattr(self._local, "client", None)
        if client is None:
            client = create_client(self._url, self._key)
            self._local.client = client
        return client

    def __getattr__(self, name):
        return getattr(self._get(), name)


supabase = _ThreadLocalSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)


supabase_admin = _ThreadLocalSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
