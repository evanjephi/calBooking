import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPublicPosts, imageUrl } from "../api/api";

export default function ResourceHub() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicPosts("clients")
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const featured = posts.find((p) => p.featured);
  const rest = posts.filter((p) => p._id !== featured?._id);

  if (loading) return <p className="center-text">Loading…</p>;

  return (
    <div className="public-page">
      <div className="public-hero">
        <h1>Resource Hub</h1>
        <p>
          Our Resource Hub empowers families with knowledge and guidance on personal care
          services. Explore helpful articles to better understand the care process and make
          informed decisions for your loved ones.
        </p>
      </div>

      <div className="hub-content">
        {featured && (
          <Link to={`/resources/${featured.slug}`} className="hub-featured-card">
            {featured.coverImage && (
              <img src={imageUrl(featured.coverImage)} alt={featured.title} className="hub-featured-img" />
            )}
            <div className="hub-featured-overlay">
              <span className="badge badge-green">FEATURED</span>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <span className="hub-read-more">Read Article →</span>
            </div>
          </Link>
        )}

        <div className="hub-grid">
          {rest.map((post) => (
            <Link key={post._id} to={`/resources/${post.slug}`} className="hub-card">
              {post.coverImage && (
                <img src={imageUrl(post.coverImage)} alt={post.title} className="hub-card-img" />
              )}
              <div className="hub-card-body">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <span className="hub-read-more-btn">Read More →</span>
              </div>
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <p className="center-text" style={{ padding: 60 }}>
            No articles published yet. Check back soon!
          </p>
        )}

        <div className="hub-cta">
          <h2>Need More Help?</h2>
          <p>Our team is here to assist you in finding the right care solutions for your family.</p>
          <Link to="/contact" className="btn btn-secondary">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
