import { useState, useEffect } from "react";
import { getPublicPage } from "../api/api";

export default function AboutUs() {
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getPublicPage("about-us").then(setPage).catch((e) => setError(e.message));
  }, []);

  if (error) return (
    <div className="public-page">
      <div className="public-hero">
        <h1>About Us</h1>
      </div>
      <div className="public-content">
        <p>This page hasn't been created yet. An admin can create it from the admin panel with the slug "about-us".</p>
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
