import { Cake, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

// Deliberately NOT a bordered card / grid like the other dashboard
// widgets — just a loose horizontal-scrolling strip of chips so it
// reads as a lightweight "by the way, here's who's celebrating" note
// rather than another boxed report. Backed by GET /dashboard/celebrations
// (see app/dashboard/services.py -> get_celebrations), which merges
// employees.date_of_birth (birthdays) and employees.joining_date
// (work anniversaries) for the whole company, next 30 days.

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function relativeLabel(daysAway) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return new Date(Date.now() + daysAway * 86400000).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short" },
  );
}

function Chip({ person, icon, accent, sublabel }) {
  return (
    <div
      className={`flex items-center gap-2.5 shrink-0 pl-1.5 pr-3 py-1.5 rounded-full border ${accent}`}
    >
      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[11px] font-semibold text-slate-600 overflow-hidden shrink-0">
        {person.profile_photo ? (
          <img
            src={person.profile_photo}
            alt={person.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          initials(person.full_name)
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-xs font-medium text-slate-800 truncate">
          {icon} {person.full_name}
        </div>
        <div className="text-[11px] text-slate-500 truncate">
          {sublabel} · {relativeLabel(person.days_away)}
        </div>
      </div>
    </div>
  );
}

export default function CelebrationsStrip() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiClient
      .get("/dashboard/celebrations?days=30")
      .then((res) => setData(res || { birthdays: [], anniversaries: [] }))
      .catch(() => setData({ birthdays: [], anniversaries: [] }));
  }, []);

  const birthdays = data?.birthdays || [];
  const anniversaries = data?.anniversaries || [];
  const items = [...birthdays, ...anniversaries];

  if (data && items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 py-1 overflow-x-auto">
      <span className="text-xs font-medium text-slate-400 shrink-0 whitespace-nowrap">
        🎉 Coming up
      </span>

      {!data &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-11 w-40 bg-slate-100 rounded-full animate-pulse shrink-0"
          />
        ))}

      {birthdays.map((p) => (
        <Chip
          key={`bday-${p.employee_id}`}
          person={p}
          icon={<Cake size={12} className="text-pink-500" />}
          accent="border-pink-100 bg-pink-50/60"
          sublabel="Birthday"
        />
      ))}

      {anniversaries.map((p) => (
        <Chip
          key={`anniv-${p.employee_id}`}
          person={p}
          icon={<PartyPopper size={12} className="text-purple-500" />}
          accent="border-purple-100 bg-purple-50/60"
          sublabel={`${p.years} yr${p.years === 1 ? "" : "s"} anniversary`}
        />
      ))}
    </div>
  );
}
