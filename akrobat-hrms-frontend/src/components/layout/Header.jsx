import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  Clock,
  LogOut,
  Megaphone,
  Search,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROLE_BASE_PATH, ROLE_LABELS } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../services/apiClient";

// Notification bell now backed by the real API (see app/notifications —
// GET /notifications/my, PUT /:id/read, PUT /my/read-all). The leaves
// module fires an insert into this table whenever a request is applied
// for (-> manager) or approved/rejected (-> employee), so this dropdown
// is what surfaces those to the person it concerns.

const TYPE_STYLES = {
  LEAVE: { icon: CalendarClock, className: "text-orange-500 bg-orange-50" },
  OVERTIME: { icon: Clock, className: "text-blue-500 bg-blue-50" },
  ATTENDANCE: { icon: Clock, className: "text-blue-500 bg-blue-50" },
  SYSTEM: { icon: Megaphone, className: "text-slate-500 bg-slate-100" },
  GENERAL: { icon: Bell, className: "text-slate-500 bg-slate-100" },
};

function typeStyle(type) {
  return TYPE_STYLES[(type || "").toUpperCase()] || TYPE_STYLES.GENERAL;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function NotificationBell() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const ref = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tracks notification ids we've already shown (in the list or as a
  // toast), so a poll only toasts genuinely *new* arrivals — not every
  // pre-existing unread notification on first page load, and not the
  // same notification twice on the next poll.
  const seenIdsRef = useRef(null);

  function load() {
    apiClient
      .get("/notifications/my")
      .then((res) => {
        const rows = res?.data || [];
        setNotifications(rows);

        if (seenIdsRef.current === null) {
          // First load this session — just record what's already there,
          // don't toast for it (that's what the bell badge is for).
          seenIdsRef.current = new Set(rows.map((n) => n.id));
          return;
        }

        const newOnes = rows.filter((n) => !seenIdsRef.current.has(n.id));
        for (const n of newOnes) {
          seenIdsRef.current.add(n.id);
          const { icon: Icon, className } = typeStyle(n.notification_type);
          showToast({
            title: n.title,
            message: n.message,
            icon: Icon,
            iconClassName: className,
            onClick: () => {
              setOpen(false);
              navigate(`${ROLE_BASE_PATH[role] || ""}/notifications`);
            },
          });
        }
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // Polling (not a real-time push channel) — short enough that a new
    // notification (leave approved/rejected, a Super Admin's late
    // check-in alert, etc.) shows up as a toast + updated badge within
    // ~20s on its own, without the user needing to refresh the page.
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const recent = notifications.slice(0, 6);

  async function markOneRead(n) {
    if (n.is_read) return;
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
    );
    try {
      await apiClient.put(`/notifications/${n.id}/read`);
    } catch {
      // Non-critical — a background refresh will resync state.
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await apiClient.put("/notifications/my/read-all");
    } catch {
      // Non-critical — a background refresh will resync state.
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white shadow-lg rounded-xl border border-slate-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h4 className="text-sm font-semibold text-slate-800">
              Notifications
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-orange-600 font-medium hover:underline"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2">
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
                <div className="h-10 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {recent.map((n) => {
                  const { icon: Icon, className } = typeStyle(
                    n.notification_type,
                  );
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => markOneRead(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors ${
                          !n.is_read ? "bg-orange-50/40" : ""
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${className}`}
                        >
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate(`${ROLE_BASE_PATH[role] || ""}/notifications`);
            }}
            className="w-full text-center text-xs font-medium text-orange-600 py-2.5 border-t border-slate-100 hover:bg-orange-50"
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, role, logout } = useAuth();

  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);

  // Load profile photo
  useEffect(() => {
    function loadProfilePhoto() {
      const possibleIds = [
        user?.employee_id,
        user?.id,
        user?.employee?.id,
        user?.profile?.employee_id,
      ].filter(Boolean);

      for (const id of possibleIds) {
        const photo = localStorage.getItem(`akrobat_profile_photo_${id}`);

        if (photo) {
          setProfilePhoto(photo);
          return;
        }
      }

      setProfilePhoto(null);
    }

    loadProfilePhoto();

    window.addEventListener("akrobat:profile-photo-updated", loadProfilePhoto);

    return () => {
      window.removeEventListener(
        "akrobat:profile-photo-updated",
        loadProfilePhoto,
      );
    };
  }, [user]);

  return (
    <header className="header h-16 flex items-center justify-between px-4 sm:px-6 bg-white border-b border-slate-200 sticky top-0 z-20">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            placeholder="Search anything..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
      </div>

      {/* Notifications + Profile */}
      <div className="flex items-center gap-2 ml-auto">
        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-sm overflow-hidden">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (user?.name?.[0] ?? "U")
              )}
            </div>

            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>

              <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
            </div>

            <ChevronDown size={16} className="hidden sm:block text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg border border-slate-100 py-1 z-50">
              {/* My Profile */}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate(`${ROLE_BASE_PATH[role] || ""}/profile/personal`);
                }}
                className="w-full text-left px-4 py-2 flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <UserIcon size={15} />
                My Profile
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 flex items-center gap-2 text-sm text-orange-500 hover:bg-orange-50"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
