import { useState, useEffect, useMemo } from "react";
import { getAdminPSWs, deleteAdminPSW, updateAdminPSW, createAdminPSW, imageUrl } from "../../api/api";

const STATUS_LABELS = {
  pending: { text: "Pending", cls: "badge-warning" },
  approved: { text: "Approved", cls: "badge-success" },
  rejected: { text: "Rejected", cls: "badge-danger" },
  "": { text: "No Application", cls: "badge-muted" }
};

export default function AdminPSWs() {
  const [psws, setPsws] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAdminPSWs().then(setPsws).catch((e) => setError(e.message));
  }, []);

  const statusFiltered = filter === "all"
    ? psws
    : psws.filter(p => (p.applicationStatus || "") === filter);

  const filtered = useMemo(() => {
    if (!search.trim()) return statusFiltered;
    const q = search.toLowerCase();
    return statusFiltered.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      (p.homeAddress?.city || "").toLowerCase().includes(q) ||
      (p.serviceLevels || []).some(s => s.toLowerCase().includes(q))
    );
  }, [statusFiltered, search]);

  const pendingCount = psws.filter(p => p.applicationStatus === "pending").length;

  async function handleDelete(id) {
    if (!confirm("Delete this PSW worker?")) return;
    try {
      await deleteAdminPSW(id);
      setPsws((prev) => prev.filter((p) => p._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSave(id, data) {
    try {
      const updated = await updateAdminPSW(id, data);
      setPsws((prev) => prev.map((p) => (p._id === id ? updated : p)));
      setEditing(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const updated = await updateAdminPSW(id, { applicationStatus: status });
      setPsws((prev) => prev.map((p) => (p._id === id ? updated : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(data) {
    try {
      const created = await createAdminPSW(data);
      setPsws((prev) => [...prev, created]);
      setShowNew(false);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>PSW Workers {pendingCount > 0 && <span className="badge-warning" style={{ fontSize: 14, marginLeft: 8 }}>{pendingCount} pending</span>}</h1>
        <button className="btn btn-teal" onClick={() => setShowNew(true)}>+ New PSW</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-filters">
          {["all", "pending", "approved", "rejected", ""].map(f => (
            <button
              key={f}
              className={`btn ${filter === f ? "btn-teal" : "btn-secondary"}`}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "" ? "No Application" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input
          className="admin-search-input"
          type="text"
          placeholder="Search by name, city, or service level…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showNew && (
        <PSWForm onSave={handleCreate} onCancel={() => setShowNew(false)} />
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>Service Levels</th>
              <th>Experience</th>
              <th>Bookings</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((psw) => (
              <>
                <tr key={psw._id}>
                  {editing === psw._id ? (
                    <EditPSWRow psw={psw} onSave={(data) => handleSave(psw._id, data)} onCancel={() => setEditing(null)} />
                  ) : (
                    <>
                      <td><strong>{psw.firstName} {psw.lastName}</strong></td>
                      <td>{psw.homeAddress?.city || "—"}</td>
                      <td>{(psw.serviceLevels || []).map(s => s.replace("_", " ")).join(", ") || "—"}</td>
                      <td>{psw.yearsExperience || 0} yrs</td>
                      <td>{psw.bookingCount || 0}</td>
                      <td>
                        <span className={`app-badge ${(STATUS_LABELS[psw.applicationStatus || ""] || STATUS_LABELS[""]).cls}`}>
                          {(STATUS_LABELS[psw.applicationStatus || ""] || STATUS_LABELS[""]).text}
                        </span>
                      </td>
                      <td className="admin-table-actions">
                        {psw.applicationStatus === "pending" && (
                          <>
                            <button onClick={() => handleStatusChange(psw._id, "approved")} className="btn btn-teal" style={{ fontSize: 12, padding: "4px 10px" }}>Approve</button>
                            <button onClick={() => handleStatusChange(psw._id, "rejected")} className="btn btn-outline-danger" style={{ fontSize: 12, padding: "4px 10px" }}>Reject</button>
                          </>
                        )}
                        {psw.applicationStatus === "rejected" && (
                          <button onClick={() => handleStatusChange(psw._id, "approved")} className="btn btn-teal" style={{ fontSize: 12, padding: "4px 10px" }}>Approve</button>
                        )}
                        {psw.applicationStatus === "approved" && (
                          <button onClick={() => handleStatusChange(psw._id, "rejected")} className="btn btn-outline-danger" style={{ fontSize: 12, padding: "4px 10px" }}>Revoke</button>
                        )}
                        <button onClick={() => setExpanded(expanded === psw._id ? null : psw._id)} className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>
                          {expanded === psw._id ? "Hide" : "View"}
                        </button>
                        <button onClick={() => setEditing(psw._id)} className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>Edit</button>
                        <button onClick={() => handleDelete(psw._id)} className="btn btn-outline-danger" style={{ fontSize: 12, padding: "4px 10px" }}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
                {expanded === psw._id && (
                  <tr key={`${psw._id}-detail`}>
                    <td colSpan={6}>
                      <div className="psw-detail-panel">
                        <div className="psw-detail-grid">
                          <div><strong>Gender:</strong> {psw.gender || "—"}</div>
                          <div><strong>Rating:</strong> ⭐ {psw.rating || "—"}</div>
                          <div><strong>Address:</strong> {psw.homeAddress?.street || "—"}, {psw.homeAddress?.city || "—"} {psw.homeAddress?.postalCode || ""}</div>
                          <div><strong>Certifications:</strong> {(psw.certifications || []).join(", ") || "—"}</div>
                          <div><strong>Languages:</strong> {(psw.languages || []).join(", ") || "—"}</div>
                          <div><strong>Availability:</strong> {psw.availabilityPreferences ? Object.entries(psw.availabilityPreferences).filter(([,v]) => v).map(([k]) => k).join(", ") || "—" : "—"}</div>
                          <div><strong>Referred:</strong> {psw.referredByPSW || "—"}</div>
                        </div>
                        {psw.shortIntro && (
                          <div style={{ marginTop: 12 }}>
                            <strong>Short Intro:</strong>
                            <p style={{ marginTop: 4, color: "var(--muted)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{psw.shortIntro}</p>
                          </div>
                        )}
                        <div className="psw-detail-docs">
                          <strong>Documents:</strong>
                          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                            {psw.governmentId && <a href={imageUrl(psw.governmentId)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>Gov ID</a>}
                            {psw.backgroundCheck && <a href={imageUrl(psw.backgroundCheck)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>Background Check</a>}
                            {psw.resume && <a href={imageUrl(psw.resume)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>Resume</a>}
                            {!psw.governmentId && !psw.backgroundCheck && !psw.resume && <span style={{ color: "var(--muted)" }}>No documents uploaded</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="center-text">No PSW workers found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditPSWRow({ psw, onSave, onCancel }) {
  const [firstName, setFirstName] = useState(psw.firstName);
  const [lastName, setLastName] = useState(psw.lastName);
  const [city, setCity] = useState(psw.homeAddress?.city || "");
  const [yearsExperience, setYearsExperience] = useState(psw.yearsExperience || 1);
  const [rating, setRating] = useState(psw.rating || 4.5);

  return (
    <>
      <td>
        <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: "48%", marginRight: "4%" }} />
        <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: "48%" }} />
      </td>
      <td><input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} /></td>
      <td>—</td>
      <td><input type="number" className="form-input" value={yearsExperience} onChange={(e) => setYearsExperience(+e.target.value)} style={{ width: 70 }} /></td>
      <td><input type="number" step="0.1" className="form-input" value={rating} onChange={(e) => setRating(+e.target.value)} style={{ width: 70 }} /></td>
      <td className="admin-table-actions">
        <button onClick={() => onSave({ firstName, lastName, homeAddress: { city }, yearsExperience, rating })} className="btn btn-teal">Save</button>
        <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
      </td>
    </>
  );
}

function PSWForm({ onSave, onCancel }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("Toronto");
  const [postalCode, setPostalCode] = useState("");
  const [lng, setLng] = useState(-79.3957);
  const [lat, setLat] = useState(43.6629);

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3>New PSW Worker</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>First Name</label>
          <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="form-group">
          <label>City</label>
          <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Postal Code</label>
          <input className="form-input" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Longitude</label>
          <input type="number" step="0.0001" className="form-input" value={lng} onChange={(e) => setLng(+e.target.value)} />
        </div>
        <div className="form-group">
          <label>Latitude</label>
          <input type="number" step="0.0001" className="form-input" value={lat} onChange={(e) => setLat(+e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <button className="btn btn-teal" onClick={() => onSave({
          firstName, lastName,
          homeAddress: { city, postalCode },
          location: { type: "Point", coordinates: [lng, lat] }
        })}>Create</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
