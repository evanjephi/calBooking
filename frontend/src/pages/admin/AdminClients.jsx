import { useState, useEffect, useMemo } from "react";
import { getAdminClients, deleteAdminClient, updateAdminClient, createAdminClient } from "../../api/api";

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAdminClients().then(setClients).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.address?.city || "").toLowerCase().includes(q) ||
      (c.address?.postalCode || "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  async function handleDelete(id) {
    if (!confirm("Delete this client?")) return;
    try {
      await deleteAdminClient(id);
      setClients((prev) => prev.filter((c) => c._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSave(id, data) {
    try {
      const updated = await updateAdminClient(id, data);
      setClients((prev) => prev.map((c) => (c._id === id ? updated : c)));
      setEditing(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleCreate(data) {
    try {
      const created = await createAdminClient(data);
      setClients((prev) => [...prev, created]);
      setShowNew(false);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Clients</h1>
        <button className="btn btn-teal" onClick={() => setShowNew(true)}>+ New Client</button>
      </div>

      <div className="admin-toolbar">
        <div></div>
        <input
          className="admin-search-input"
          type="text"
          placeholder="Search by name, city, or postal code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showNew && (
        <ClientForm
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>Postal Code</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client._id}>
                {editing === client._id ? (
                  <EditClientRow
                    client={client}
                    onSave={(data) => handleSave(client._id, data)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <td><strong>{client.firstName} {client.lastName}</strong></td>
                    <td>{client.address?.city || "—"}</td>
                    <td>{client.address?.postalCode || "—"}</td>
                    <td className="admin-table-actions">
                      <button onClick={() => setEditing(client._id)} className="btn btn-secondary">Edit</button>
                      <button onClick={() => handleDelete(client._id)} className="btn btn-outline-danger">Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="center-text">No clients found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditClientRow({ client, onSave, onCancel }) {
  const [firstName, setFirstName] = useState(client.firstName);
  const [lastName, setLastName] = useState(client.lastName);
  const [city, setCity] = useState(client.address?.city || "");
  const [postalCode, setPostalCode] = useState(client.address?.postalCode || "");

  return (
    <>
      <td>
        <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" style={{ width: "48%", marginRight: "4%" }} />
        <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" style={{ width: "48%" }} />
      </td>
      <td><input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} /></td>
      <td><input className="form-input" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></td>
      <td className="admin-table-actions">
        <button onClick={() => onSave({ firstName, lastName, address: { city, postalCode } })} className="btn btn-teal">Save</button>
        <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
      </td>
    </>
  );
}

function ClientForm({ onSave, onCancel }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [city, setCity] = useState("Toronto");
  const [postalCode, setPostalCode] = useState("");

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3>New Client</h3>
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
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <button className="btn btn-teal" onClick={() => onSave({ firstName, lastName, address: { city, postalCode } })}>Create</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
