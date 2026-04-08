import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { getAdminPage, createAdminPage, updateAdminPage } from "../../api/api";

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "link", "image"],
    ["clean"],
  ],
};

export default function AdminPageEdit() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("default");
  const [status, setStatus] = useState("draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      getAdminPage(id).then((page) => {
        setTitle(page.title);
        setSlug(page.slug);
        setBody(page.body || "");
        setTemplate(page.template);
        setStatus(page.status);
      }).catch((e) => setError(e.message));
    }
  }, [id, isNew]);

  function autoSlug(t) {
    return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const data = { title, slug: slug || autoSlug(title), body, template, status };
    try {
      if (isNew) {
        await createAdminPage(data);
      } else {
        await updateAdminPage(id, data);
      }
      navigate("/admin/pages");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>{isNew ? "New Page" : "Edit Page"}</h1>
      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-grid">
          <div className="form-group">
            <label>Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (isNew) setSlug(autoSlug(e.target.value));
              }}
              required
            />
          </div>
          <div className="form-group">
            <label>Slug</label>
            <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Template</label>
            <select className="form-input" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="default">Default</option>
              <option value="contact">Contact (with form)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="form-group full-width">
          <label>Body</label>
          <ReactQuill theme="snow" value={body} onChange={setBody} modules={quillModules} />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button type="submit" className="btn btn-teal" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create Page" : "Update Page"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/pages")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
