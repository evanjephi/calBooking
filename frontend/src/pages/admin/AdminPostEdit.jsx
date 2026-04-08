import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { getAdminPost, createAdminPost, updateAdminPost } from "../../api/api";
import ImageUpload from "../../components/ImageUpload";

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "link", "image"],
    ["clean"],
  ],
};

export default function AdminPostEdit() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverImage, setCoverImage] = useState(null);
  const [category, setCategory] = useState("clients");
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState("draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      getAdminPost(id).then((post) => {
        setTitle(post.title);
        setSlug(post.slug);
        setExcerpt(post.excerpt || "");
        setBody(post.body || "");
        setCoverImage(post.coverImage);
        setCategory(post.category);
        setFeatured(post.featured);
        setStatus(post.status);
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
    const data = { title, slug: slug || autoSlug(title), excerpt, body, coverImage, category, featured, status };
    try {
      if (isNew) {
        await createAdminPost(data);
      } else {
        await updateAdminPost(id, data);
      }
      navigate("/admin/posts");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>{isNew ? "New Post" : "Edit Post"}</h1>
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
            <label>Category</label>
            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="clients">Resources for Clients</option>
              <option value="providers">Resources for Providers</option>
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

        <div className="form-group">
          <label>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            {" "}Featured Post
          </label>
        </div>

        <div className="form-group">
          <label>Cover Image</label>
          <ImageUpload value={coverImage} onChange={setCoverImage} />
        </div>

        <div className="form-group full-width">
          <label>Excerpt</label>
          <textarea
            className="form-input"
            rows={3}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short preview text for card display…"
          />
        </div>

        <div className="form-group full-width">
          <label>Body</label>
          <ReactQuill theme="snow" value={body} onChange={setBody} modules={quillModules} />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button type="submit" className="btn btn-teal" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create Post" : "Update Post"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate("/admin/posts")}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
