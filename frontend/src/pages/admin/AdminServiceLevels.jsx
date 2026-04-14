import { useState, useEffect } from "react";
import {
  getAdminServiceLevels,
  createAdminServiceLevel,
  updateAdminServiceLevel,
  deleteAdminServiceLevel
} from "../../api/api";

const EMPTY_FORM = {
  key: "",
  label: "",
  description: "",
  clientRate: "",
  pswRate: "",
  icon: "🏠",
  examples: "",
  popular: false,
  active: true,
  sortOrder: 0
};

export default function AdminServiceLevels() {
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // id or "new"
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    loadLevels();
  }, []);

  async function loadLevels() {
    try {
      const data = await getAdminServiceLevels();
      setLevels(data);
    } catch (e) {
      setError(e.message);
    }
  }

  function startNew() {
    setForm({ ...EMPTY_FORM });
    setEditing("new");
  }

  function startEdit(level) {
    setForm({
      key: level.key,
      label: level.label,
      description: level.description || "",
      clientRate: level.clientRate,
      pswRate: level.pswRate,
      icon: level.icon || "🏠",
      examples: level.examples || "",
      popular: level.popular || false,
      active: level.active !== false,
      sortOrder: level.sortOrder || 0
    });
    setEditing(level._id);
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  }

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setError("");
    if (!form.label.trim()) return setError("Label is required");
    if (!form.clientRate || form.clientRate <= 0) return setError("Client rate must be positive");
    if (!form.pswRate || form.pswRate <= 0) return setError("PSW rate must be positive");

    try {
      if (editing === "new") {
        if (!form.key.trim()) return setError("Key is required for new service level");
        const created = await createAdminServiceLevel({
          ...form,
          clientRate: Number(form.clientRate),
          pswRate: Number(form.pswRate),
          sortOrder: Number(form.sortOrder)
        });
        setLevels(prev => [...prev, created]);
      } else {
        const updated = await updateAdminServiceLevel(editing, {
          label: form.label,
          description: form.description,
          clientRate: Number(form.clientRate),
          pswRate: Number(form.pswRate),
          icon: form.icon,
          examples: form.examples,
          popular: form.popular,
          active: form.active,
          sortOrder: Number(form.sortOrder)
        });
        setLevels(prev => prev.map(l => (l._id === editing ? updated : l)));
      }
      cancelEdit();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this service level? This cannot be undone.")) return;
    try {
      await deleteAdminServiceLevel(id);
      setLevels(prev => prev.filter(l => l._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleToggleActive(level) {
    try {
      const updated = await updateAdminServiceLevel(level._id, { active: !level.active });
      setLevels(prev => prev.map(l => (l._id === level._id ? updated : l)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Service Levels & Rates</h1>
        <button className="btn btn-teal" onClick={startNew}>+ New Service Level</button>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        Manage service tiers, client-facing rates, and PSW pay rates. Changes are reflected across the entire platform.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {/* New / Edit form */}
      {editing && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3>{editing === "new" ? "New Service Level" : `Edit: ${form.label}`}</h3>
          <div className="form-grid">
            {editing === "new" && (
              <div className="form-group">
                <label>Key (lowercase, no spaces) *</label>
                <input
                  className="form-input"
                  value={form.key}
                  onChange={(e) => updateField("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. home_helper"
                />
              </div>
            )}
            <div className="form-group">
              <label>Label *</label>
              <input className="form-input" value={form.label} onChange={(e) => updateField("label", e.target.value)} placeholder="e.g. Help Around the House" />
            </div>
            <div className="form-group">
              <label>Client Rate ($/hr) *</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.clientRate} onChange={(e) => updateField("clientRate", e.target.value)} />
            </div>
            <div className="form-group">
              <label>PSW Pay Rate ($/hr) *</label>
              <input className="form-input" type="number" step="0.01" min="0" value={form.pswRate} onChange={(e) => updateField("pswRate", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Icon</label>
              <input className="form-input" value={form.icon} onChange={(e) => updateField("icon", e.target.value)} style={{ width: 80 }} />
            </div>
            <div className="form-group">
              <label>Sort Order</label>
              <input className="form-input" type="number" value={form.sortOrder} onChange={(e) => updateField("sortOrder", e.target.value)} style={{ width: 80 }} />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Description</label>
              <textarea className="form-input" rows={2} value={form.description} onChange={(e) => updateField("description", e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Examples (comma-separated)</label>
              <input className="form-input" value={form.examples} onChange={(e) => updateField("examples", e.target.value)} placeholder="Cooking, cleaning, laundry..." />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.popular} onChange={(e) => updateField("popular", e.target.checked)} />
                Mark as Popular
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} />
                Active (visible to clients)
              </label>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button className="btn btn-teal" onClick={handleSave}>
              {editing === "new" ? "Create" : "Save Changes"}
            </button>
            <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Icon</th>
              <th>Key</th>
              <th>Label</th>
              <th>Client Rate</th>
              <th>PSW Rate</th>
              <th>Margin</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level._id} style={{ opacity: level.active ? 1 : 0.5 }}>
                <td>{level.sortOrder}</td>
                <td style={{ fontSize: 20 }}>{level.icon}</td>
                <td><code>{level.key}</code></td>
                <td>
                  <strong>{level.label}</strong>
                  {level.popular && <span className="badge badge-teal" style={{ marginLeft: 6 }}>Popular</span>}
                </td>
                <td className="rate-cell">CA${level.clientRate.toFixed(2)}/hr</td>
                <td className="rate-cell">CA${level.pswRate.toFixed(2)}/hr</td>
                <td className="rate-cell">
                  <span style={{ color: "var(--teal)", fontWeight: 600 }}>
                    CA${(level.clientRate - level.pswRate).toFixed(2)}
                  </span>
                </td>
                <td>
                  <button
                    className={`btn ${level.active ? "btn-teal" : "btn-secondary"}`}
                    style={{ fontSize: 11, padding: "3px 10px" }}
                    onClick={() => handleToggleActive(level)}
                  >
                    {level.active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="admin-table-actions">
                  <button onClick={() => startEdit(level)} className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }}>Edit</button>
                  <button onClick={() => handleDelete(level._id)} className="btn btn-outline-danger" style={{ fontSize: 12, padding: "4px 10px" }}>Delete</button>
                </td>
              </tr>
            ))}
            {levels.length === 0 && (
              <tr><td colSpan={9} className="center-text">No service levels. Click "+ New Service Level" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
