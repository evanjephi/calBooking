import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAdminPages, deleteAdminPage } from "../../api/api";

export default function AdminPages() {
  const [pages, setPages] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminPages().then(setPages).catch((e) => setError(e.message));
  }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this page?")) return;
    try {
      await deleteAdminPage(id);
      setPages((prev) => prev.filter((p) => p._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Pages</h1>
        <Link to="/admin/pages/new" className="btn btn-teal">+ New Page</Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Template</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page._id}>
                <td><strong>{page.title}</strong></td>
                <td><a href={`/pages/${page.slug}`} target="_blank" rel="noopener noreferrer">/pages/{page.slug}</a></td>
                <td>{page.template}</td>
                <td>
                  <span className={`badge ${page.status === "published" ? "badge-green" : "badge-yellow"}`}>
                    {page.status}
                  </span>
                </td>
                <td className="admin-table-actions">
                  <Link to={`/admin/pages/${page._id}/edit`} className="btn btn-secondary">Edit</Link>
                  <button onClick={() => handleDelete(page._id)} className="btn btn-outline-danger">Delete</button>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr><td colSpan={5} className="center-text">No pages found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
