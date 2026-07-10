import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

// GET /attendance/check-in, /check-out, /break-start, /break-end all work
// for ANY logged-in user regardless of role (see app/attendance/routes.py —
// they only depend on get_current_user, not a permission). So this card is
// dropped into every dashboard, not just the Employee one: a Manager, HR
// Admin, or Super Admin is still a person who can check in/out for their
// own attendance record.
//
// ---------------------------------------------------------------------
// Location / anti-fake-checkin logic
// ---------------------------------------------------------------------
// The backend already supports geofencing (see _validate_geofence in
// app/attendance/services.py) — check-in/out accepts latitude, longitude,
// and location_id, and rejects the request if you're further than that
// location's `radius` (meters) away. But it only ENFORCES this when a
// location_id is actually sent — if you omit it, no check happens at all.
// So to actually get anti-fake-checkin behavior, this card must:
//   1. Ask the browser for real GPS coordinates (navigator.geolocation) —
//      not something the user can type in, unlike a manual "office" dropdown.
//   2. Fetch the company's configured locations (GET /locations) and find
//      the nearest one client-side (Haversine formula).
//   3. Send that location's id + the real coordinates on check-in/check-out,
//      so the backend performs the actual radius check server-side.
// The client-side "nearest office" distance shown here is just a preview
// for the user — the backend re-validates independently and is the real
// enforcement point, so this can't be spoofed by editing the UI.
//
// It only breaks for accounts with no linked `employees` row (e.g. the
// bootstrap Super Admin created purely via scripts/create_super_admin.py,
// before anyone attaches an employee profile to it) — handled below with a
// quiet "not linked to an employee profile" state instead of a crash.

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Xh Ym" for a minutes count — used for the working-hours / break-hours
// summary that appears once the day's check-out lands.
function formatDuration(minutes) {
  if (minutes == null) return "--";
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Haversine distance in meters — mirrors _haversine_meters in
// app/attendance/services.py so the client-side preview matches what the
// server will actually decide.
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// The backend stores raw check_in/check_out latitude+longitude on the
// attendance row (see app/attendance/services.py) but not a location name —
// so to actually *show* "checked in at Main Office" we match those saved
// coordinates against the same company locations list used for the live
// "nearest office" preview above, and take whichever is closest.
function nearestLocationName(lat, lon, locations) {
  if (lat == null || lon == null || !locations || locations.length === 0) {
    return null;
  }
  let best = null;
  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const d = distanceMeters(lat, lon, loc.latitude, loc.longitude);
    if (!best || d < best.distance) best = { loc, distance: d };
  }
  return best ? best.loc.location_name : null;
}

export default function CheckInOutCard({ onActivityChange } = {}) {
  const [today, setToday] = useState(null); // attendance row for today, or null
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // true while a check-in/out call is in flight
  const [error, setError] = useState(null);
  const [notLinked, setNotLinked] = useState(false);

  // Geolocation state
  const [locations, setLocations] = useState([]);
  const [coords, setCoords] = useState(null); // { latitude, longitude }
  const [geoStatus, setGeoStatus] = useState("locating"); // locating | ok | denied | unsupported
  const [nearest, setNearest] = useState(null); // { location, distance, withinRadius }

  // Reverse-geocoded place name for the detected GPS fix, so we can show
  // "City, State, Country" (e.g. "Chennai, Tamil Nadu, India") instead of
  // raw coordinates — and, per the request, surface which country the
  // check-in is being attempted from.
  const [place, setPlace] = useState(null); // { city, region, country }
  const [placeLoading, setPlaceLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/attendance/timeline/${todayIso()}`);
      setToday(res.data ?? null);
    } catch (err) {
      // No employee profile linked -> backend returns data: null via a 200,
      // so a thrown error here is a real failure, not "no record yet".
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Turns a GPS fix into a human-readable "City, State, Country" via a free,
  // no-API-key reverse-geocoding lookup (BigDataCloud's client-side endpoint —
  // CORS-enabled specifically for browser use, no backend proxy needed).
  // This is what actually tells us — and shows the user — which country the
  // check-in attempt is coming from.
  async function reverseGeocode(latitude, longitude) {
    setPlaceLoading(true);
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      );
      if (!res.ok) throw new Error("reverse geocode failed");
      const data = await res.json();
      setPlace({
        city: data.city || data.locality || data.principalSubdivision || null,
        region: data.principalSubdivision || null,
        country: data.countryName || null,
        countryCode: data.countryCode || null,
      });
    } catch {
      setPlace(null);
    } finally {
      setPlaceLoading(false);
    }
  }

  // Pulled out so it can run both automatically on mount AND again on demand
  // when the user taps "Detect Location" (e.g. after they granted permission
  // following an earlier denial, or just want a fresh GPS fix).
  function detectLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("locating");
    setPlace(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });
        setGeoStatus("ok");
        reverseGeocode(latitude, longitude);
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    load();

    apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch(() => setLocations([]));

    detectLocation();
  }, []);

  // Recompute nearest office whenever we have both a GPS fix and the location list.
  useEffect(() => {
    if (!coords || locations.length === 0) {
      setNearest(null);
      return;
    }
    let best = null;
    for (const loc of locations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      const d = distanceMeters(
        coords.latitude,
        coords.longitude,
        loc.latitude,
        loc.longitude,
      );
      if (!best || d < best.distance) best = { location: loc, distance: d };
    }
    if (best) {
      setNearest({
        ...best,
        withinRadius: best.distance <= (best.location.radius ?? Infinity),
      });
    }
  }, [coords, locations]);

  async function runAction(path, successReload = true) {
    setBusy(true);
    setError(null);
    try {
      // Always send whatever real GPS fix we have. location_id is only
      // included when we actually matched one — the backend skips the
      // geofence check entirely if location_id is missing, so an unmatched
      // location deliberately does NOT get silently treated as "in range".
      const body = coords
        ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            ...(nearest ? { location_id: nearest.location.id } : {}),
          }
        : {};
      await apiClient.post(path, body);
      if (successReload) await load();
      // Audit-log entries for this action land on the backend as part of
      // the same request (see app/attendance/services.py), so Recent
      // Activity can be refreshed immediately rather than waiting for the
      // next full page load / poll.
      onActivityChange?.();
    } catch (err) {
      if (err.status === 403 && /no employee profile/i.test(err.message)) {
        setNotLinked(true);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const onBreak =
    today?.breaks?.length > 0 &&
    !today.breaks[today.breaks.length - 1].break_end;
  const checkedIn = !!today?.check_in_time;
  const checkedOut = !!today?.check_out_time;

  const checkInLocation = nearestLocationName(
    today?.check_in_latitude,
    today?.check_in_longitude,
    locations,
  );
  const checkOutLocation = nearestLocationName(
    today?.check_out_latitude,
    today?.check_out_longitude,
    locations,
  );

  if (notLinked) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Clock size={16} />
          This account isn't linked to an employee profile, so attendance
          check-in/out isn't available here.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Today's Attendance</h3>
        {checkedIn && !checkedOut && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            <CheckCircle2 size={13} /> Checked in
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-16 bg-slate-100 rounded animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-3 text-center">
            <div>
              <div className="text-xs text-slate-400 mb-1">Check In</div>
              <div className="font-semibold text-slate-700">
                {formatTime(today?.check_in_time)}
              </div>
              {checkInLocation && (
                <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-slate-400">
                  <MapPin size={9} />
                  <span className="truncate max-w-[72px]">
                    {checkInLocation}
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Check Out</div>
              <div className="font-semibold text-slate-700">
                {formatTime(today?.check_out_time)}
              </div>
              {checkOutLocation && (
                <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-slate-400">
                  <MapPin size={9} />
                  <span className="truncate max-w-[72px]">
                    {checkOutLocation}
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Status</div>
              <div className="font-semibold text-slate-700">
                {today?.status || "Not checked in"}
              </div>
            </div>
          </div>

          {/* ---------- Location status — the anti-fake-checkin signal ---------- */}
          {!checkedIn && !checkedOut && (
            <div className="mb-3 text-xs rounded-lg px-3 py-2.5 bg-slate-50">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-start gap-2 min-w-0">
                  {geoStatus === "locating" && (
                    <>
                      <MapPin
                        size={13}
                        className="text-slate-400 animate-pulse shrink-0 mt-0.5"
                      />
                      <span className="text-slate-500">
                        Getting your location…
                      </span>
                    </>
                  )}
                  {geoStatus === "denied" && (
                    <>
                      <AlertTriangle
                        size={13}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                      <span className="text-amber-600">
                        Location access denied — check-in won't be
                        location-verified.
                      </span>
                    </>
                  )}
                  {geoStatus === "unsupported" && (
                    <>
                      <AlertTriangle
                        size={13}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                      <span className="text-amber-600">
                        This browser doesn't support location.
                      </span>
                    </>
                  )}
                  {geoStatus === "ok" && nearest && nearest.withinRadius && (
                    <>
                      <MapPin
                        size={13}
                        className="text-emerald-500 shrink-0 mt-0.5"
                      />
                      <span className="text-emerald-600">
                        Within range of {nearest.location.location_name} (
                        {Math.round(nearest.distance)}m)
                      </span>
                    </>
                  )}
                  {geoStatus === "ok" && nearest && !nearest.withinRadius && (
                    <>
                      <AlertTriangle
                        size={13}
                        className="text-red-500 shrink-0 mt-0.5"
                      />
                      <span className="text-red-500">
                        {Math.round(nearest.distance)}m from{" "}
                        {nearest.location.location_name} — outside the{" "}
                        {nearest.location.radius}m radius
                      </span>
                    </>
                  )}
                  {geoStatus === "ok" && !nearest && (
                    <>
                      <MapPin
                        size={13}
                        className="text-slate-400 shrink-0 mt-0.5"
                      />
                      <span className="text-slate-500">
                        Location acquired — no office locations configured yet.
                      </span>
                    </>
                  )}
                </div>

                {/* Manual trigger — click to (re)detect instead of relying
                    only on the automatic check on page load. */}
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={geoStatus === "locating"}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 px-2 py-1 rounded-md"
                >
                  <MapPin size={11} />
                  {geoStatus === "locating" ? "Detecting…" : "Detect Location"}
                </button>
              </div>

              {/* ---------- Real map preview, centered on the GPS fix ----------
                  Uses OpenStreetMap's own embeddable export (no API key, no
                  CORS/rate-limit issues like third-party static-image
                  services) — an iframe pointed at a small bounding box
                  around the detected coordinates, with a marker. */}
              {geoStatus === "ok" && coords && (
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 h-[130px]">
                  <iframe
                    title="Detected location map"
                    className="w-full h-full border-0"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      coords.longitude - 0.01
                    }%2C${coords.latitude - 0.01}%2C${
                      coords.longitude + 0.01
                    }%2C${coords.latitude + 0.01}&layer=mapnik&marker=${
                      coords.latitude
                    }%2C${coords.longitude}`}
                  />
                </div>
              )}

              {geoStatus === "ok" && coords && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1 text-emerald-600 font-medium">
                    <MapPin size={11} className="shrink-0" />
                    <span>
                      Location Detected
                      {placeLoading && " — resolving…"}
                    </span>
                  </div>
                  {!placeLoading && place && (
                    <div className="text-slate-600 mt-0.5 pl-[17px]">
                      {[place.city, place.region, place.country]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  <div className="text-slate-400 mt-0.5 pl-[17px]">
                    {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500 mb-3">
              {error}
              {error.toLowerCase().includes("expired") && (
                <span className="text-slate-400">
                  {" "}
                  — your session will refresh automatically; if this persists,
                  please log in again.
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!checkedIn && (
              <button
                onClick={() => runAction("/attendance/check-in")}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                <LogIn size={15} /> Check In
              </button>
            )}

            {checkedIn && !checkedOut && !onBreak && (
              <button
                onClick={() => runAction("/attendance/break-start")}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                <Coffee size={15} /> Start Break
              </button>
            )}

            {checkedIn && !checkedOut && onBreak && (
              <button
                onClick={() => runAction("/attendance/break-end")}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors"
              >
                <Coffee size={15} /> End Break
              </button>
            )}

            {checkedIn && !checkedOut && (
              <button
                onClick={() => runAction("/attendance/check-out")}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                <LogOut size={15} /> Check Out
              </button>
            )}

            {checkedOut && (
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-400 text-sm font-medium py-2 rounded-lg cursor-not-allowed"
              >
                <LogOut size={15} /> Checked Out
              </button>
            )}
          </div>

          {/* ---------- Working hours / break hours, right under the
              disabled "Checked Out" button — moved here from above the
              buttons row so it reads as the summary of that checkout
              instead of appearing disconnected from it. ---------- */}
          {checkedOut && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-orange-50 rounded-lg py-2.5 text-center">
                <div className="text-[10px] text-orange-500 font-medium mb-0.5 flex items-center justify-center gap-1">
                  <Clock size={11} /> Working Hours
                </div>
                <div className="font-semibold text-slate-800 text-sm">
                  {formatDuration(today?.working_minutes)}
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg py-2.5 text-center">
                <div className="text-[10px] text-slate-500 font-medium mb-0.5 flex items-center justify-center gap-1">
                  <Coffee size={11} /> Break Hours
                </div>
                <div className="font-semibold text-slate-800 text-sm">
                  {formatDuration(today?.break_minutes)}
                </div>
              </div>
            </div>
          )}

          {/* ---------- Last Location ---------- */}
          {(checkInLocation || checkOutLocation) && (
            <div className="mt-3 bg-indigo-50 rounded-lg p-2.5 flex items-center gap-2.5 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MapPin size={14} className="text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 font-medium">
                    Last Location
                  </div>
                  <div className="text-xs text-slate-700 truncate">
                    {checkOutLocation || checkInLocation}
                  </div>
                </div>
              </div>

              {/* Real map thumbnail (same OSM embed used above) centered on
                  whichever coordinate we actually have — check-out if the
                  day is done, otherwise check-in. */}
              {(() => {
                const lat =
                  today?.check_out_latitude ?? today?.check_in_latitude;
                const lon =
                  today?.check_out_longitude ?? today?.check_in_longitude;
                if (lat == null || lon == null) return null;
                return (
                  <div className="w-20 h-14 rounded-md overflow-hidden border border-indigo-100 shrink-0">
                    <iframe
                      title="Last location map"
                      className="w-full h-full border-0 pointer-events-none"
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                        lon - 0.006
                      }%2C${lat - 0.006}%2C${lon + 0.006}%2C${
                        lat + 0.006
                      }&layer=mapnik&marker=${lat}%2C${lon}`}
                    />
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
