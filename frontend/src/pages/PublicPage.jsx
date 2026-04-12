import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicPage } from "../api/api";

export default function PublicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(null);
    setError("");
    getPublicPage(slug).then(setPage).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return (
    <div className="public-page">
      <div className="public-hero">
        <h1>Page Not Found</h1>
      </div>
      <div className="public-content">
        <p>The page you're looking for doesn't exist or hasn't been published yet.</p>
      </div>
    </div>
  );

  if (!page) return <p className="center-text">Loading…</p>;

  return (
    <div className="public-page">
      <div className="public-hero">
        <h1>{page.title}</h1>
      </div>
      <div className="public-content" dangerouslySetInnerHTML={{ __html: page.body }} />
    </div>
  );
}
