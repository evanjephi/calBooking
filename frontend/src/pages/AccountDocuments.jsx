import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getMyDocuments, addDocument, removeDocument, imageUrl } from "../api/api";

const REQUIRED_LABELS = {
  governmentId: "Government ID",
  backgroundCheck: "Background Check",
  resume: "Resume / CV"
};

export default function AccountDocuments() {
  const { user } = useAuth();
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function loadDocs() {
    try {
      const data = await getMyDocuments();
      setDocs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocs(); }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setError(""); setMsg("");
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("label", label || file.name);
      await addDocument(formData);
      setMsg("Document uploaded");
      setFile(null); setLabel("");
      e.target.reset();
      await loadDocs();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(docId) {
    if (!confirm("Remove this document?")) return;
    setError(""); setMsg("");
    try {
      await removeDocument(docId);
      setMsg("Document removed");
      await loadDocs();
    } catch (err) {
      setError(err.message);
    }
  }

  if (user?.role !== "psw") {
    return (
      <div className="account-page">
        <h1>My Documents</h1>
        <p>Document management is available for PSW providers only.</p>
      </div>
    );
  }

  if (loading) return <p className="center-text">Loading documents…</p>;

  return (
    <div className="account-page">
      <h1>My Documents</h1>

      {error && <div className="msg-error">{error}</div>}
      {msg && <div className="msg-success">{msg}</div>}

      <div className="account-section">
        <h2>Required Documents</h2>
        <div className="docs-grid">
          {Object.entries(REQUIRED_LABELS).map(([key, displayLabel]) => {
            const doc = docs?.required?.[key];
            return (
              <div key={key} className="doc-card">
                <div className="doc-card-label">{displayLabel}</div>
                {doc ? (
                  <div className="doc-card-info">
                    <span className="doc-card-filename">{doc.filename}</span>
                    <a href={imageUrl(doc._id)} target="_blank" rel="noopener noreferrer" className="btn-sm">View</a>
                  </div>
                ) : (
                  <span className="doc-card-missing">Not uploaded</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="account-section">
        <h2>Additional Documents</h2>
        {docs?.additional?.length > 0 ? (
          <div className="docs-list">
            {docs.additional.map(d => (
              <div key={d._id} className="doc-row">
                <span className="doc-row-label">{d.label}</span>
                <span className="doc-row-date">{new Date(d.uploadedAt).toLocaleDateString()}</span>
                <a href={imageUrl(d.file?._id || d.file)} target="_blank" rel="noopener noreferrer" className="btn-sm">View</a>
                <button className="btn-sm btn-danger" onClick={() => handleRemove(d._id)}>Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No additional documents uploaded yet.</p>
        )}

        <form onSubmit={handleUpload} className="doc-upload-form">
          <div className="form-group">
            <label>Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. First Aid Certificate" />
          </div>
          <div className="form-group">
            <label>File (JPG, PNG, or PDF, max 10MB)</label>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setFile(e.target.files[0])} required />
          </div>
          <button type="submit" className="btn-primary" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload Document"}
          </button>
        </form>
      </div>
    </div>
  );
}
