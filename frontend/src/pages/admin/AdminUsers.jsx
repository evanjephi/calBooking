import { useState, useEffect, useMemo } from "react";
import { getAdminUsers, updateAdminUser, deleteAdminUser } from "../../api/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAdminUsers().then(setUsers).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  async function handleRoleChange(id, role) {
    try {
      const updated = await updateAdminUser(id, { role });
      setUsers((prev) => prev.map((u) => (u._id === id ? updated : u)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      await deleteAdminUser(id);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Users</h1>
      </div>

      <div className="admin-toolbar">
        <div></div>
        <input
          className="admin-search-input"
          type="text"
          placeholder="Search by name, email, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Source</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u._id}>
                <td><strong>{u.firstName} {u.lastName}</strong></td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="form-input"
                    value={u.role}
                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                    style={{ width: "auto", padding: "4px 8px", fontSize: 13 }}
                  >
                    <option value="client">Client</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td><span className="badge badge-teal">{u.source || "web"}</span></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="admin-table-actions">
                  <button onClick={() => handleDelete(u._id)} className="btn btn-outline-danger">Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="center-text">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
