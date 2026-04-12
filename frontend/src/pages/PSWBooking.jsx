// frontend/src/pages/PSWBooking.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPSWProfile, getBookingRequest, getPSWBookedSlots, checkPSWConflict, selectPSW, saveContact, confirmRequest, finalizeBooking } from "../api/api";
import { useAuth } from "../context/AuthContext";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const SERVICE_LEVEL_INFO = {
  home_helper: { label: "Help Around the House", rate: 24.25 },
  care_services: { label: "Personal Care", rate: 26.19 },
  specialized_care: { label: "Specialized Care", rate: 27.84 },
};

const CC_FEE_RATE = 0.04;
const HST_RATE = 0.13;

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

function BookingMap({ coordinates }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!MAPS_API_KEY || !window.google?.maps || !mapRef.current || !coordinates) return;
    const pos = { lat: coordinates[1], lng: coordinates[0] };
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: pos, zoom: 13,
        disableDefaultUI: true, zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }
    new window.google.maps.Marker({
      position: pos, map: mapInstance.current,
      icon: { url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png", scaledSize: new window.google.maps.Size(40, 40) },
    });
  }, [coordinates]);

  if (!MAPS_API_KEY || !coordinates) return null;
  return <div ref={mapRef} style={{ width: "100%", height: 220, borderRadius: "var(--radius-lg)" }} />;
}

function formatTimeLabel(hour) {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

export default function PSWBooking() {
  const { pswId, reqId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [psw, setPsw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Starting date carried from Step 2
  const [startingDate, setStartingDate] = useState("");

  // Schedule state
  const [schedules, setSchedules] = useState([]);
  const [pickDate, setPickDate] = useState("");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(12);

  // Recurring mode
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState([]);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [recurringStartDate, setRecurringStartDate] = useState("");

  // Service level
  const [serviceLevel, setServiceLevel] = useState("home_helper");

  // Conflict / booked-slots state
  const [bookedSlots, setBookedSlots] = useState([]);
  const [conflictModal, setConflictModal] = useState(null); // { date, startHour, endHour, alternatives }
  const [recurringConflictModal, setRecurringConflictModal] = useState(null); // { conflicts: [{date, alternatives}], nonConflicts: [...], startHour, endHour }
  const [checking, setChecking] = useState(false);

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0=frequency, 1=time, 2=review
  const [bookingMode, setBookingMode] = useState(""); // "one-time" | "recurring" | "weekdays"
  const [selectedTimeBlock, setSelectedTimeBlock] = useState("Morning");

  useEffect(() => {
    // Fetch PSW profile, booking request, and booked slots in parallel
    const fromDate = new Date().toISOString().split("T")[0];
    const toDate = new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0];

    Promise.all([
      getPSWProfile(pswId),
      getBookingRequest(reqId),
      getPSWBookedSlots(pswId, fromDate, toDate),
    ])
      .then(([pswData, reqData, slotsData]) => {
        setPsw(pswData);
        if (pswData.serviceLevels?.length > 0) {
          setServiceLevel(pswData.serviceLevels[0]);
        }
        // Carry forward starting date from Step 2
        if (reqData.specificDate) {
          const dateStr = reqData.specificDate.split("T")[0];
          setStartingDate(dateStr);
          setPickDate(dateStr);
          setRecurringStartDate(dateStr);
        }
        // Use service level from booking request if available
        if (reqData.serviceLevel) {
          setServiceLevel(reqData.serviceLevel);
        }
        // Store booked slots for conflict visualization
        setBookedSlots(slotsData.bookedSlots || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [pswId, reqId]);

  const slInfo = SERVICE_LEVEL_INFO[serviceLevel] || SERVICE_LEVEL_INFO.home_helper;

  // Check if a specific hour on a date is booked (uses backend's pre-computed local hours)
  function isHourBooked(date, hour) {
    return bookedSlots.some((slot) => {
      if (slot.date !== date) return false;
      return hour >= slot.startHour && hour < slot.endHour;
    });
  }

  // Check if a range overlaps any booked slot (client-side pre-check)
  function hasLocalConflict(date, sHour, eHour) {
    return bookedSlots.some((slot) => {
      if (slot.date !== date) return false;
      return sHour < slot.endHour && eHour > slot.startHour;
    });
  }

  async function addSchedule() {
    if (!pickDate || startHour >= endHour) return;

    // Server-side conflict check
    setChecking(true);
    try {
      const result = await checkPSWConflict(pswId, { date: pickDate, startHour, endHour, reqId });
      if (result.conflict) {
        // Show conflict modal with alternatives
        setConflictModal({
          date: pickDate,
          startHour,
          endHour,
          alternatives: result.alternatives || [],
          conflictDetail: result.conflictDetail,
        });
        setChecking(false);
        return;
      }
    } catch {
      // If conflict check fails, fall back to local check
      if (hasLocalConflict(pickDate, startHour, endHour)) {
        setConflictModal({ date: pickDate, startHour, endHour, alternatives: [], conflictDetail: null });
        setChecking(false);
        return;
      }
    }
    setChecking(false);

    const id = Date.now();
    setSchedules((prev) => [...prev, { id, date: pickDate, startHour, endHour, pswId, pswName: `${psw.firstName} ${psw.lastName}` }]);
  }

  // Accept an alternative PSW for a conflicted slot
  function acceptAlternative(altPsw) {
    const { date, startHour: sH, endHour: eH } = conflictModal;
    const id = Date.now();
    setSchedules((prev) => [
      ...prev,
      { id, date, startHour: sH, endHour: eH, pswId: altPsw._id, pswName: `${altPsw.firstName} ${altPsw.lastName}`, isAlternative: true },
    ]);
    setConflictModal(null);
  }

  function toggleRecurringDay(day) {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function generateRecurringSchedules() {
    if (recurringDays.length === 0 || !recurringStartDate || startHour >= endHour) return;

    setChecking(true);
    setError(null);

    const start = new Date(recurringStartDate + "T00:00:00");

// Replace the date generation block (lines ~203-222)
const dateSet = new Set();
const datesToCheck = [];

for (let week = 0; week < recurringWeeks; week++) {
  for (const day of recurringDays) {
    const targetDayIndex = DAY_INDEX[day];
    const weekBase = new Date(start);           // fresh Date each iteration
    weekBase.setDate(weekBase.getDate() + (week * 7));
    const currentDay = weekBase.getDay();
    let diff = targetDayIndex - currentDay;
    if (diff < 0) diff += 7;
    weekBase.setDate(weekBase.getDate() + diff);

    if (weekBase >= start) {
      const dateStr = `${weekBase.getFullYear()}-${String(weekBase.getMonth() + 1).padStart(2, "0")}-${String(weekBase.getDate()).padStart(2, "0")}`;
      if (!dateSet.has(dateStr)) {             // ← prevent duplicates
        dateSet.add(dateStr);
        datesToCheck.push(dateStr);
      }
    }
  }
}

    // Server-side conflict check for each date
    const conflicts = [];
    const nonConflicts = [];

    for (const dateStr of datesToCheck) {
      try {
        const result = await checkPSWConflict(pswId, { date: dateStr, startHour, endHour, reqId });
        if (result.conflict) {
          conflicts.push({ date: dateStr, alternatives: result.alternatives || [] });
        } else {
          nonConflicts.push(dateStr);
        }
      } catch {
        // Fallback to local check
        if (hasLocalConflict(dateStr, startHour, endHour)) {
          conflicts.push({ date: dateStr, alternatives: [] });
        } else {
          nonConflicts.push(dateStr);
        }
      }
    }

    // Add non-conflicting dates immediately
    const pswName = psw ? `${psw.firstName} ${psw.lastName}` : "";
    const newSchedules = nonConflicts.map((dateStr) => ({
      id: Date.now() + Math.random(),
      date: dateStr,
      startHour,
      endHour,
      pswId,
      pswName,
    }));

    newSchedules.sort((a, b) => a.date.localeCompare(b.date));
    setSchedules((prev) => {
      const existingDates = new Set(prev.map((s) => `${s.date}-${s.startHour}-${s.endHour}`));
      const unique = newSchedules.filter((s) => !existingDates.has(`${s.date}-${s.startHour}-${s.endHour}`));
      return [...prev, ...unique];
    });

    setChecking(false);

    if (conflicts.length > 0) {
      // Show recurring conflict modal for user to assign alternative PSWs
      setRecurringConflictModal({ conflicts, nonConflicts, startHour, endHour });
    } else {
      setIsRecurring(false);
    }
  }

  // Accept an alternative PSW for one recurring conflict date
  function acceptRecurringAlternative(dateStr, altPsw) {
    const sH = recurringConflictModal.startHour;
    const eH = recurringConflictModal.endHour;
    setSchedules((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        date: dateStr,
        startHour: sH,
        endHour: eH,
        pswId: altPsw._id,
        pswName: `${altPsw.firstName} ${altPsw.lastName}`,
        isAlternative: true,
      },
    ]);
    // Remove this date from the conflict list
    setRecurringConflictModal((prev) => {
      const remaining = prev.conflicts.filter((c) => c.date !== dateStr);
      if (remaining.length === 0) {
        setIsRecurring(false);
        return null;
      }
      return { ...prev, conflicts: remaining };
    });
  }

  // Skip a conflicted date (don't book it)
  function skipRecurringConflict(dateStr) {
    setRecurringConflictModal((prev) => {
      const remaining = prev.conflicts.filter((c) => c.date !== dateStr);
      if (remaining.length === 0) {
        setIsRecurring(false);
        return null;
      }
      return { ...prev, conflicts: remaining };
    });
  }

  // Skip all remaining conflicts
  function skipAllRecurringConflicts() {
    setRecurringConflictModal(null);
    setIsRecurring(false);
  }

  function removeSchedule(id) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  // Pricing
  const totalHours = schedules.reduce((sum, s) => sum + (s.endHour - s.startHour), 0);
  const subtotal = totalHours * slInfo.rate;
  const ccFee = subtotal * CC_FEE_RATE;
  const hst = subtotal * HST_RATE;
  const total = subtotal + ccFee + hst;

  async function handleSubmit() {
    if (schedules.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      // Always send schedules as slotAssignments so the backend uses the
      // exact dates/times the user picked (not the auto-generated ones
      // from the original BookingRequest fields).
      const pswGroups = {};
      for (const s of schedules) {
        const pid = s.pswId || pswId;
        if (!pswGroups[pid]) {
          pswGroups[pid] = { pswId: pid, pswName: s.pswName || `${psw.firstName} ${psw.lastName}`, slots: [] };
        }
        pswGroups[pid].slots.push({
          date: new Date(`${s.date}T${String(s.startHour).padStart(2, "0")}:00:00`),
          startTime: new Date(`${s.date}T${String(s.startHour).padStart(2, "0")}:00:00`),
          endTime: new Date(`${s.date}T${String(s.endHour).padStart(2, "0")}:00:00`),
        });
      }
      await selectPSW(reqId, { slotAssignments: Object.values(pswGroups) });

      const contactPayload = {};
      if (user?.email) contactPayload.email = user.email;
      if (!contactPayload.email) contactPayload.email = "noreply@premierpsw.ca";
      await saveContact(reqId, contactPayload);
      await confirmRequest(reqId);
      const result = await finalizeBooking(reqId);
      navigate(`/book/${reqId}/success`, { state: result });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page"><p className="center-text">Please wait, loading your booking…</p></div>;
  if (!psw) return <div className="page"><div className="error-banner">Caregiver not found.</div></div>;

  const photoUrl = psw.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(psw.firstName + "+" + psw.lastName)}&size=256&background=5f8d7e&color=fff`;
  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // ── Wizard sub-step labels ──
  const wizardLabels = ["How often?", "What time?", "Review & Confirm"];

  // ── Time block presets ──
  const TIME_BLOCKS = [
    { label: "Morning", desc: "8 AM – 12 PM", startHour: 8, endHour: 12 },
    { label: "Afternoon", desc: "12 PM – 4 PM", startHour: 12, endHour: 16 },
    { label: "Evening", desc: "4 PM – 8 PM", startHour: 16, endHour: 20 },
  ];

  return (
    <div className="page">
      <div className="step-indicator">Step 4 of 4</div>

      {/* Caregiver banner */}
      <div className="service-banner">
        <div className="service-banner-info">
          <img src={photoUrl} alt={psw.firstName} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
          <div>
            <h4>{psw.firstName} {psw.lastName}</h4>
            <p className="rate">{slInfo.label} — CA${slInfo.rate.toFixed(2)}/hr</p>
          </div>
        </div>
        <button className="btn-change" onClick={() => navigate(`/psw/${pswId}/${reqId}`)}>Change</button>
      </div>

      <h1 style={{ marginBottom: 4 }}>Book {psw.firstName}</h1>

      {/* Wizard progress */}
      <div className="wizard-progress">
        {wizardLabels.map((label, i) => (
          <div key={i} className={`wizard-step-dot ${wizardStep === i ? "active" : wizardStep > i ? "done" : ""}`}>
            <span className="wizard-dot">{wizardStep > i ? "✓" : i + 1}</span>
            <span className="wizard-label">{label}</span>
          </div>
        ))}
      </div>

      {error && <div className="error-banner mb-24">{error}</div>}

      {/* ═══════════════════════════════════════════════
          WIZARD STEP 0: How often do you need care?
          ═══════════════════════════════════════════════ */}
      {wizardStep === 0 && (
        <div className="wizard-panel">
          <h2>How often do you need care?</h2>

          <div className="frequency-options">
            <button type="button"
              className={`frequency-btn ${bookingMode === "one-time" ? "selected" : ""}`}
              onClick={() => setBookingMode("one-time")}>
              <span className="frequency-icon">📅</span>
              <span className="frequency-title">Just once</span>
              <span className="frequency-desc">A single visit on a specific date</span>
            </button>
            <button type="button"
              className={`frequency-btn ${bookingMode === "recurring" ? "selected" : ""}`}
              onClick={() => setBookingMode("recurring")}>
              <span className="frequency-icon">🔄</span>
              <span className="frequency-title">A few days each week</span>
              <span className="frequency-desc">Recurring visits on the days you choose</span>
            </button>
            <button type="button"
              className={`frequency-btn ${bookingMode === "weekdays" ? "selected" : ""}`}
              onClick={() => { setBookingMode("weekdays"); setRecurringDays(["Monday","Tuesday","Wednesday","Thursday","Friday"]); }}>
              <span className="frequency-icon">📆</span>
              <span className="frequency-title">Every weekday</span>
              <span className="frequency-desc">Monday through Friday, every week</span>
            </button>
          </div>

          {/* Recurring day selection */}
          {bookingMode === "recurring" && (
            <div className="wizard-sub-section">
              <label>Which days of the week?</label>
              <div className="day-picker">
                {ALL_DAYS.map((day) => (
                  <button key={day} type="button"
                    className={`day-btn ${recurringDays.includes(day) ? "selected" : ""}`}
                    onClick={() => toggleRecurringDay(day)}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Number of weeks (for recurring / weekdays) */}
          {bookingMode !== "one-time" && (
            <div className="wizard-sub-section">
              <label>For how many weeks?</label>
              <div className="weeks-picker">
                {[2, 4, 8, 12].map((n) => (
                  <button key={n} type="button"
                    className={`week-btn ${recurringWeeks === n ? "selected" : ""}`}
                    onClick={() => setRecurringWeeks(n)}>
                    {n} weeks
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn btn-secondary" onClick={() => navigate(`/psw/${pswId}/${reqId}`)}>← Back</button>
            <button className="btn btn-primary"
              disabled={!bookingMode || (bookingMode === "recurring" && recurringDays.length === 0)}
              onClick={() => setWizardStep(1)}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          WIZARD STEP 1: What time works best?
          ═══════════════════════════════════════════════ */}
      {wizardStep === 1 && (
        <div className="wizard-panel">
          <h2>What time of day works best?</h2>

          <div className="time-block-options">
            {TIME_BLOCKS.map((block) => (
              <button key={block.label} type="button"
                className={`time-block-btn ${selectedTimeBlock === block.label ? "selected" : ""}`}
                onClick={() => {
                  setSelectedTimeBlock(block.label);
                  const dur = endHour - startHour;
                  const keepDur = dur > 0 && dur <= (block.endHour - block.startHour) ? dur : 3;
                  setStartHour(block.startHour);
                  setEndHour(block.startHour + keepDur);
                }}>
                <span className="time-block-title">{block.label}</span>
                <span className="time-block-desc">{block.desc}</span>
              </button>
            ))}
            <button type="button"
              className={`time-block-btn ${selectedTimeBlock === "custom" ? "selected" : ""}`}
              onClick={() => setSelectedTimeBlock("custom")}>
              <span className="time-block-title">Custom Time</span>
              <span className="time-block-desc">Choose your own hours</span>
            </button>
          </div>

          {selectedTimeBlock === "custom" && (
            <div className="wizard-sub-section">
              <div className="time-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <select className="form-input" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                    {Array.from({ length: 15 }, (_, i) => i + 6).map((h) => (
                      <option key={h} value={h}>{formatTimeLabel(h)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <select className="form-input" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
                    {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => (
                      <option key={h} value={h}>{formatTimeLabel(h)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Visit duration */}
          <div className="wizard-sub-section">
            <label>How long should each visit be?</label>
            <div className="duration-picker">
              {[{ h: 1, label: "1 hour" }, { h: 2, label: "2 hours" }, { h: 3, label: "3 hours" }, { h: 4, label: "4 hours" }].map(({ h, label }) => {
                const isSelected = (endHour - startHour) === h;
                return (
                  <button key={h} type="button"
                    className={`duration-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => setEndHour(startHour + h)}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start time within the selected block */}
          {selectedTimeBlock !== "custom" && (() => {
            const block = TIME_BLOCKS.find((b) => b.label === selectedTimeBlock);
            if (!block) return null;
            const duration = endHour - startHour;
            const validDuration = duration > 0 && duration <= (block.endHour - block.startHour) ? duration : 3;
            const maxStart = block.endHour - validDuration;
            const starts = [];
            for (let h = block.startHour; h <= maxStart; h++) starts.push(h);
            if (starts.length <= 1) return null;
            return (
              <div className="wizard-sub-section">
                <label>What time should the visit start?</label>
                <div className="start-time-picker">
                  {starts.map((h) => (
                    <button key={h} type="button"
                      className={`start-time-btn ${startHour === h ? "selected" : ""}`}
                      onClick={() => { setStartHour(h); setEndHour(h + validDuration); }}>
                      {formatTimeLabel(h)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Selected time confirmation */}
          {startHour < endHour && (
            <div className="wizard-sub-section">
              <div className="selected-time-display">
                Your visit: <strong>{formatTimeLabel(startHour)} – {formatTimeLabel(endHour)}</strong> ({endHour - startHour} hour{endHour - startHour !== 1 ? "s" : ""})
              </div>
            </div>
          )}

          {/* Starting date */}
          <div className="wizard-sub-section">
            <label>{bookingMode === "one-time" ? "What date?" : "Starting from what date?"}</label>
            <input className="form-input" type="date"
              value={bookingMode === "one-time" ? pickDate : recurringStartDate}
              min={minDate}
              onChange={(e) => {
                if (bookingMode === "one-time") setPickDate(e.target.value);
                else setRecurringStartDate(e.target.value);
              }} />
          </div>

          <div className="wizard-actions">
            <button className="btn btn-secondary" onClick={() => setWizardStep(0)}>← Back</button>
            <button className="btn btn-primary"
              disabled={startHour >= endHour || !(bookingMode === "one-time" ? pickDate : recurringStartDate) || checking}
              onClick={async () => {
                // Generate the schedule — appends to existing schedules
                if (bookingMode === "one-time") {
                  await addSchedule();
                } else {
                  if (bookingMode === "weekdays") {
                    setRecurringDays(["Monday","Tuesday","Wednesday","Thursday","Friday"]);
                  }
                  await generateRecurringSchedules();
                }
                setWizardStep(2);
              }}>
              {checking ? "Checking availability…" : "Next →"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          WIZARD STEP 2: Review & Confirm
          ═══════════════════════════════════════════════ */}
      {wizardStep === 2 && (
        <div className="wizard-panel">
          <h2>Review Your Booking</h2>

          {/* Caregiver summary */}
          <div className="review-card">
            <div className="review-row">
              <img src={photoUrl} alt={psw.firstName} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
              <div>
                <p style={{ fontWeight: 600, color: "var(--text-h)" }}>{psw.firstName} {psw.lastName}</p>
                <p style={{ fontSize: 13, color: "var(--text)" }}>{slInfo.label}</p>
              </div>
            </div>
          </div>

          {/* Schedule summary */}
          {schedules.length > 0 ? (
            <div className="review-card">
              <h3 style={{ marginBottom: 12 }}>Your Schedule</h3>
              <div className="review-schedule-list">
                {schedules.map((s) => (
                  <div key={s.id} className={`schedule-item ${s.isAlternative ? "schedule-item-alt" : ""}`}>
                    <div className="schedule-item-info">
                      <span style={{ fontWeight: 600, color: "var(--text-h)" }}>
                        {new Date(s.date + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span>{formatTimeLabel(s.startHour)} – {formatTimeLabel(s.endHour)}</span>
                      <span style={{ color: "var(--teal)", fontWeight: 600 }}>{s.endHour - s.startHour}h</span>
                      {s.isAlternative && <span className="alt-psw-badge">↔ {s.pswName}</span>}
                    </div>
                    <button className="remove-btn" onClick={() => removeSchedule(s.id)}>Remove</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary mt-8" style={{ width: "100%", fontSize: 13 }}
                onClick={() => { setWizardStep(1); }}>
                + Add More Time Slots
              </button>
            </div>
          ) : (
            <div className="review-card" style={{ textAlign: "center", color: "var(--text)" }}>
              <p>No sessions scheduled yet.</p>
              <button className="btn btn-secondary mt-8" onClick={() => setWizardStep(1)}>← Go back and pick a time</button>
            </div>
          )}

          {/* Pricing breakdown */}
          {schedules.length > 0 && (
            <div className="pricing-breakdown">
              <h3>Cost Summary</h3>
              <div className="pricing-row">
                <span>{totalHours} hour{totalHours !== 1 ? "s" : ""} × CA${slInfo.rate.toFixed(2)}/hr</span>
                <span>CA${subtotal.toFixed(2)}</span>
              </div>
              <div className="pricing-row">
                <span>Credit Card Fee (4%)</span>
                <span>CA${ccFee.toFixed(2)}</span>
              </div>
              <div className="pricing-row">
                <span>HST (13%)</span>
                <span>CA${hst.toFixed(2)}</span>
              </div>
              <div className="pricing-row total">
                <span>Total</span>
                <span>CA${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Go Back</button>
            <button className="btn btn-primary" disabled={schedules.length === 0 || submitting}
              onClick={handleSubmit}>
              {submitting ? "Processing your booking…" : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}

      {/* ── Conflict Modal (single date) ── */}
      {conflictModal && (
        <div className="modal-overlay" onClick={() => setConflictModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="conflict-modal-title">⚠ Scheduling Conflict</h3>
            <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 16 }}>
              <strong>{psw.firstName} {psw.lastName}</strong> is not available on{" "}
              <strong>
                {new Date(conflictModal.date + "T00:00:00").toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
              </strong>{" "}
              at your selected time ({formatTimeLabel(conflictModal.startHour)} – {formatTimeLabel(conflictModal.endHour)}).
            </p>

            {conflictModal.alternatives.length > 0 ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)", marginBottom: 12 }}>
                  Would you like one of these caregivers instead?
                </p>
                <div className="alt-psw-list">
                  {conflictModal.alternatives.map((alt) => {
                    const altPhoto = alt.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(alt.firstName + "+" + alt.lastName)}&size=64&background=5f8d7e&color=fff`;
                    return (
                      <div key={alt._id} className="alt-psw-card" onClick={() => acceptAlternative(alt)}>
                        <img src={altPhoto} alt={`${alt.firstName} ${alt.lastName}`}
                          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-h)" }}>
                            {alt.firstName} {alt.lastName}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--text)" }}>
                            {alt.gender && `${alt.gender} · `}
                            {alt.yearsExperience}yr exp · {"★".repeat(Math.round(alt.rating))} {alt.rating.toFixed(1)}
                          </p>
                        </div>
                        <button className="btn btn-teal" style={{ marginLeft: "auto", fontSize: 12, padding: "6px 14px" }}>
                          Choose
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 14, color: "var(--text)" }}>
                No other caregivers are available at this time. Please pick a different time.
              </p>
            )}

            <div className="flex-row mt-16">
              <button className="btn btn-dark" onClick={() => setConflictModal(null)}>
                Pick a Different Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recurring Conflict Modal ── */}
      {recurringConflictModal && (
        <div className="modal-overlay" onClick={skipAllRecurringConflicts}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3 className="conflict-modal-title">⚠ Some Dates Have Conflicts</h3>
            <p style={{ fontSize: 14, color: "var(--text)", marginBottom: 6 }}>
              <strong>{psw.firstName} {psw.lastName}</strong> is already booked on{" "}
              <strong>{recurringConflictModal.conflicts.length}</strong> of your requested dates.
              You can choose another caregiver for those days or skip them.
            </p>

            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {recurringConflictModal.conflicts.map((c) => (
                <div key={c.date} className="recurring-conflict-item">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-h)" }}>
                      {new Date(c.date + "T00:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12, width: "auto" }}
                      onClick={() => skipRecurringConflict(c.date)}>
                      Skip This Day
                    </button>
                  </div>
                  {c.alternatives.length > 0 ? (
                    <div className="alt-psw-list-compact">
                      {c.alternatives.slice(0, 3).map((alt) => {
                        const altPhoto = alt.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(alt.firstName + "+" + alt.lastName)}&size=48&background=5f8d7e&color=fff`;
                        return (
                          <div key={alt._id} className="alt-psw-card-compact" onClick={() => acceptRecurringAlternative(c.date, alt)}>
                            <img src={altPhoto} alt={`${alt.firstName} ${alt.lastName}`}
                              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-h)" }}>
                                {alt.firstName} {alt.lastName}
                              </p>
                              <p style={{ fontSize: 11, color: "var(--text)" }}>
                                {"★".repeat(Math.round(alt.rating))} {alt.rating.toFixed(1)}
                              </p>
                            </div>
                            <button className="btn btn-teal" style={{ fontSize: 11, padding: "4px 10px" }}>
                              Book
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "var(--text)", fontStyle: "italic" }}>
                      No other caregivers available for this date.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex-row mt-16">
              <button className="btn btn-dark" onClick={skipAllRecurringConflicts}>
                Skip All & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}