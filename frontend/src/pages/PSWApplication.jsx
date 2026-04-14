import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { submitPSWApplication, getPSWApplication, getServiceLevels } from "../api/api";

const CERTIFICATIONS = [
  "Personal Support Worker Certificate",
  "CPR / First Aid",
  "Gentle Persuasive Approaches (GPA)",
  "Palliative Care",
  "Dementia Care",
  "Mental Health First Aid",
  "Medication Administration",
  "AED Certification",
  "Nursing Assistant",
  "Home Health Aide"
];

const AVAILABILITY_OPTIONS = [
  { key: "daytime", label: "Daytime (8am - 4pm)" },
  { key: "evening", label: "Evening (4pm - 12am)" },
  { key: "overnight", label: "Overnight (12am - 8am)" },
  { key: "weekend", label: "Weekends" }
];

const LANGUAGES = [
  "English", "Tigrinya", "Amharic", "French", "Mandarin", "Cantonese", "Punjabi",
  "Tagalog", "Spanish", "Portuguese", "Arabic", "Hindi",
  "Urdu", "Tamil", "Italian", "Korean", "Vietnamese"
];

const SERVICE_LEVELS_FALLBACK = [
  { key: "home_helper", label: "Home Helper", pswRate: 18.51 },
  { key: "care_services", label: "Care Services", pswRate: 19.99 },
  { key: "specialized_care", label: "Specialized Care", pswRate: 21.25 }
];

export default function PSWApplication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [existingApp, setExistingApp] = useState(null);
  const [serviceLevelOptions, setServiceLevelOptions] = useState(SERVICE_LEVELS_FALLBACK);

  const [form, setForm] = useState({
    yearsExperience: "",
    certifications: [],
    governmentId: null,
    backgroundCheck: null,
    resume: null,
    availabilityPreferences: {
      daytime: false,
      evening: false,
      overnight: false,
      weekend: false
    },
    languages: [],
    serviceLevels: [],
    shortIntro: "",
    gender: "",
    referredByPSW: ""
  });

  // Dropdown open states
  const [certOpen, setCertOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getPSWApplication(),
      getServiceLevels()
    ]).then(([appData, levelsData]) => {
      if (appData.hasApplication) {
        setExistingApp(appData.application);
      }
      if (levelsData?.length) {
        setServiceLevelOptions(levelsData);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleArrayItem(field, item) {
    setForm(prev => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(item)
          ? arr.filter(i => i !== item)
          : [...arr, item]
      };
    });
  }

  function toggleAvailability(key) {
    setForm(prev => ({
      ...prev,
      availabilityPreferences: {
        ...prev.availabilityPreferences,
        [key]: !prev.availabilityPreferences[key]
      }
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!form.yearsExperience) return setError("Years of experience is required");
    if (form.certifications.length === 0) return setError("Select at least one certification");
    if (!form.governmentId) return setError("Government ID is required");
    if (!form.backgroundCheck) return setError("Background check is required");
    if (!Object.values(form.availabilityPreferences).some(Boolean)) return setError("Select at least one availability option");
    if (form.serviceLevels.length === 0) return setError("Select at least one service level");
    if (!form.shortIntro.trim()) return setError("Short intro is required");
    if (!form.gender) return setError("Gender is required");
    if (form.referredByPSW === "") return setError("Please indicate if you were referred");

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("yearsExperience", form.yearsExperience);
      formData.append("certifications", JSON.stringify(form.certifications));
      formData.append("languages", JSON.stringify(form.languages));
      formData.append("serviceLevels", JSON.stringify(form.serviceLevels));
      formData.append("availabilityPreferences", JSON.stringify(form.availabilityPreferences));
      formData.append("shortIntro", form.shortIntro);
      formData.append("gender", form.gender);
      formData.append("referredByPSW", form.referredByPSW);

      if (form.governmentId) formData.append("governmentId", form.governmentId);
      if (form.backgroundCheck) formData.append("backgroundCheck", form.backgroundCheck);
      if (form.resume) formData.append("resume", form.resume);

      await submitPSWApplication(formData);
      navigate("/psw/application-success");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="center-text">Loading…</p>;

  // Already applied — show status
  if (existingApp) {
    const statusLabels = {
      pending: { text: "Under Review", className: "status-pending" },
      approved: { text: "Approved", className: "status-approved" },
      rejected: { text: "Not Approved", className: "status-rejected" }
    };
    const s = statusLabels[existingApp.applicationStatus] || statusLabels.pending;
    return (
      <div className="psw-application-status">
        <h1>Application Status</h1>
        <div className={`application-status-badge ${s.className}`}>{s.text}</div>
        <p>Your PSW application has been submitted and is currently <strong>{s.text.toLowerCase()}</strong>.</p>
        {existingApp.applicationStatus === "approved" && (
          <p>Congratulations! Your profile is now active on the platform.</p>
        )}
        {existingApp.applicationStatus === "pending" && (
          <p>We are reviewing your documents. You will be notified once a decision is made.</p>
        )}
      </div>
    );
  }

  return (
    <div className="psw-application-page">
      <div className="psw-application-card">
        <h1>PSW Application Form</h1>
        <p className="form-subtitle">Please complete all required fields to submit your application.</p>

        <form onSubmit={handleSubmit}>
          {/* Years of Experience */}
          <div className="form-group">
            <label>Years of PSW Experience *</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="50"
              required
              value={form.yearsExperience}
              onChange={(e) => update("yearsExperience", e.target.value)}
            />
          </div>

          {/* Certifications */}
          <div className="form-group">
            <label>Certifications Held *</label>
            <div className="multi-select-wrapper">
              <button type="button" className="multi-select-trigger" onClick={() => setCertOpen(!certOpen)}>
                {form.certifications.length > 0
                  ? `${form.certifications.length} selected`
                  : "Search and select certifications..."}
                <span className="multi-select-arrow">▼</span>
              </button>
              {certOpen && (
                <div className="multi-select-dropdown">
                  {CERTIFICATIONS.map(cert => (
                    <label key={cert} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={form.certifications.includes(cert)}
                        onChange={() => toggleArrayItem("certifications", cert)}
                      />
                      {cert}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Government ID */}
          <div className="form-group">
            <label>Government issued ID, with photo (Drivers license or Health card) *</label>
            <div className="file-upload-box">
              <div className="file-upload-icon">📁</div>
              <div className="file-upload-text">
                {form.governmentId
                  ? form.governmentId.name
                  : "Upload Government issued ID, with photo (Drivers license or Health card)"}
                <br /><small>Maximum file size: 10 MB</small>
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => update("governmentId", e.target.files[0] || null)}
              />
            </div>
            <small className="form-hint">File Type: PDF/JPG</small>
          </div>

          {/* Background Check */}
          <div className="form-group">
            <label>Background Check (Police Vulnerable Sector Screening) *</label>
            <div className="file-upload-box">
              <div className="file-upload-icon">📁</div>
              <div className="file-upload-text">
                {form.backgroundCheck
                  ? form.backgroundCheck.name
                  : "Upload Background Check (Police Vulnerable Sector Screening)"}
                <br /><small>Maximum file size: 10 MB</small>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => update("backgroundCheck", e.target.files[0] || null)}
              />
            </div>
            <small className="form-hint">File Type: PDF</small>
            <small className="form-hint" style={{ color: "var(--red, #c0392b)" }}>Must be less than 12 months old</small>
          </div>

          {/* Resume */}
          <div className="form-group">
            <label>Resume</label>
            <div className="file-upload-box">
              <div className="file-upload-icon">📁</div>
              <div className="file-upload-text">
                {form.resume
                  ? form.resume.name
                  : "Upload Resume"}
                <br /><small>Maximum file size: 10 MB</small>
              </div>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => update("resume", e.target.files[0] || null)}
              />
            </div>
            <small className="form-hint">File Type: PDF</small>
            <small className="form-hint">Optional but recommended</small>
          </div>

          {/* Availability */}
          <div className="form-group">
            <label>Availability / Work Hours *</label>
            <div className="multi-select-wrapper">
              <button type="button" className="multi-select-trigger" onClick={() => setAvailOpen(!availOpen)}>
                {Object.entries(form.availabilityPreferences).filter(([,v]) => v).length > 0
                  ? `${Object.entries(form.availabilityPreferences).filter(([,v]) => v).length} selected`
                  : "Search and select availability..."}
                <span className="multi-select-arrow">▼</span>
              </button>
              {availOpen && (
                <div className="multi-select-dropdown">
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <label key={opt.key} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={form.availabilityPreferences[opt.key]}
                        onChange={() => toggleAvailability(opt.key)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Languages */}
          <div className="form-group">
            <label>Languages Spoken</label>
            <div className="multi-select-wrapper">
              <button type="button" className="multi-select-trigger" onClick={() => setLangOpen(!langOpen)}>
                {form.languages.length > 0
                  ? `${form.languages.length} selected`
                  : "Search and select languages..."}
                <span className="multi-select-arrow">▼</span>
              </button>
              {langOpen && (
                <div className="multi-select-dropdown">
                  {LANGUAGES.map(lang => (
                    <label key={lang} className="multi-select-option">
                      <input
                        type="checkbox"
                        checked={form.languages.includes(lang)}
                        onChange={() => toggleArrayItem("languages", lang)}
                      />
                      {lang}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Service Levels */}
          <div className="form-group">
            <label>What service level are you certified to perform? *</label>
            <div className="service-level-options">
              {serviceLevelOptions.map(level => (
                <label key={level.key} className={`service-level-card ${form.serviceLevels.includes(level.key) ? "selected" : ""}`}>
                  <div className="service-level-header">
                    <span className="service-level-name">{level.label}</span>
                    <span className="service-level-rate">CA${(level.pswRate || 0).toFixed(2)}/hr</span>
                  </div>
                  <small>Click ▼ and review services first</small>
                  <input
                    type="checkbox"
                    checked={form.serviceLevels.includes(level.key)}
                    onChange={() => toggleArrayItem("serviceLevels", level.key)}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Short Intro */}
          <div className="form-group">
            <label>Short Intro *</label>
            <textarea
              className="form-input"
              rows={6}
              required
              value={form.shortIntro}
              onChange={(e) => update("shortIntro", e.target.value)}
              placeholder="Hello, my name is [Name], and I've been working as a Personal Support Worker for over [X] years. I truly love what I do, and it's important to me that you feel safe, respected, and listened to every day..."
            />
          </div>

          {/* Gender */}
          <div className="form-group">
            <label>Gender *</label>
            <select
              className="form-input"
              required
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">Select gender...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Referred By */}
          <div className="form-group">
            <label>Were you referred by another PSW? *</label>
            <select
              className="form-input"
              required
              value={form.referredByPSW}
              onChange={(e) => update("referredByPSW", e.target.value)}
            >
              <option value="">Select</option>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Application"}
          </button>
        </form>
      </div>
    </div>
  );
}
