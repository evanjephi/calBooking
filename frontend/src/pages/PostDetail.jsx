import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getPublicPost, imageUrl } from "../api/api";

export default function PostDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicPost(slug)
      .then(setPost)
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) return (
    <div className="public-page">
      <div className="public-content center-text">
        <h2>Article Not Found</h2>
        <p>This article may have been removed or isn't published yet.</p>
        <Link to="/resources/clients" className="btn btn-teal" style={{ marginTop: 16 }}>Browse Articles</Link>
      </div>
    </div>
  );

  if (!post) return <p className="center-text">Loading…</p>;

  const hubLink = post.category === "providers" ? "/resources/providers" : "/resources/clients";
  const hubLabel = post.category === "providers" ? "PSW Learning Hub" : "Resource Hub";

  return (
    <div className="public-page">
      {post.coverImage && (
        <div className="post-hero-image">
          <img src={imageUrl(post.coverImage)} alt={post.title} />
        </div>
      )}
      <div className="post-detail">
        <Link to={hubLink} className="post-back-link">← Back to {hubLabel}</Link>
        <h1>{post.title}</h1>
        {post.author && (
          <p className="post-meta">
            By {post.author.firstName} {post.author.lastName} · {new Date(post.createdAt).toLocaleDateString()}
          </p>
        )}
        <div className="post-body" dangerouslySetInnerHTML={{ __html: post.body }} />
      </div>
    </div>
  );
}
