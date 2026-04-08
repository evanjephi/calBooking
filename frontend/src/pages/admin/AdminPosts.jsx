import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAdminPosts, deleteAdminPost, imageUrl } from "../../api/api";

export default function AdminPosts() {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "";

  useEffect(() => {
    getAdminPosts(category || undefined)
      .then(setPosts)
      .catch((e) => setError(e.message));
  }, [category]);

  async function handleDelete(id) {
    if (!confirm("Delete this post?")) return;
    try {
      await deleteAdminPost(id);
      setPosts((prev) => prev.filter((p) => p._id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Posts</h1>
        <Link to="/admin/posts/new" className="btn btn-teal">+ New Post</Link>
      </div>

      <div className="admin-filters">
        <button
          className={`btn ${!category ? "btn-teal" : "btn-secondary"}`}
          onClick={() => setSearchParams({})}
        >All</button>
        <button
          className={`btn ${category === "clients" ? "btn-teal" : "btn-secondary"}`}
          onClick={() => setSearchParams({ category: "clients" })}
        >Clients</button>
        <button
          className={`btn ${category === "providers" ? "btn-teal" : "btn-secondary"}`}
          onClick={() => setSearchParams({ category: "providers" })}
        >Providers</button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post._id}>
                <td>
                  {post.coverImage ? (
                    <img src={imageUrl(post.coverImage)} alt="" className="admin-table-thumb" />
                  ) : (
                    <div className="admin-table-thumb-empty">—</div>
                  )}
                </td>
                <td><strong>{post.title}</strong></td>
                <td><span className="badge badge-teal">{post.category}</span></td>
                <td>
                  <span className={`badge ${post.status === "published" ? "badge-green" : "badge-yellow"}`}>
                    {post.status}
                  </span>
                </td>
                <td>{post.featured ? "⭐" : "—"}</td>
                <td className="admin-table-actions">
                  <Link to={`/admin/posts/${post._id}/edit`} className="btn btn-secondary">Edit</Link>
                  <button onClick={() => handleDelete(post._id)} className="btn btn-outline-danger">Delete</button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={6} className="center-text">No posts found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
