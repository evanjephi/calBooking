// frontend/src/pages/PSWProfile.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPSWProfile } from "../api/api";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const SERVICE_LEVEL_LABELS = {
  home_helper: "Home Helper",
  care_services: "Care Services",
  specialized_care: "Specialized Care",
};

function ProfileMap({ coordinates }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!MAPS_API_KEY || !window.google?.maps || !mapRef.current || !coordinates) return;

    const pos = { lat: coordinates[1], lng: coordinates[0] };

    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: pos,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }

    new window.google.maps.Marker({
      position: pos,
      map: mapInstance.current,
      icon: {
        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        scaledSize: new window.google.maps.Size(40, 40),
      },
    });
  }, [coordinates]);

  if (!MAPS_API_KEY || !coordinates) return null;

  return (
    <div className="map-full-height mt-20">
      <div ref={mapRef} style={{ width: "100%", height: 300, borderRadius: "var(--radius-lg)" }} />
    </div>
  );
}

export default function PSWProfile() {
  const { pswId, reqId } = useParams();
  const navigate = useNavigate();
  const [psw, setPsw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPSWProfile(pswId)
      .then(setPsw)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [pswId]);

  if (loading) return <div className="page"><p className="center-text">Loading profile…</p></div>;
  if (error) return <div className="page"><div className="error-banner">{error}</div></div>;
  if (!psw) return <div className="page"><div className="error-banner">PSW not found.</div></div>;

  const photoUrl = psw.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(psw.firstName + "+" + psw.lastName)}&size=256&background=5f8d7e&color=fff`;

  return (
    <div className="page">
      <div className="step-indicator">Step 3 of 4 — Caregiver Profile</div>

      <div className="profile-header">
        <img className="profile-photo" src={photoUrl} alt={`${psw.firstName} ${psw.lastName}`} />
        <div className="profile-details">
          <h1>{psw.firstName} {psw.lastName}</h1>

          {psw.gender && (
            <div className="detail-row">
              <span className="detail-label">Gender</span>
              <span>{psw.gender}</span>
            </div>
          )}

          {psw.yearsExperience && (
            <div className="detail-row">
              <span className="detail-label">Experience</span>
              <span>{psw.yearsExperience} year{psw.yearsExperience !== 1 ? "s" : ""}</span>
            </div>
          )}

          {psw.rating && (
            <div className="detail-row">
              <span className="detail-label">Rating</span>
              <span>{"★".repeat(Math.round(psw.rating))} {psw.rating.toFixed(1)}</span>
            </div>
          )}

          {psw.serviceLevels?.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Services</span>
              <span>{psw.serviceLevels.map(l => SERVICE_LEVEL_LABELS[l] || l).join(", ")}</span>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-teal" onClick={() => navigate(`/psw/${pswId}/${reqId}/book`)}>
              Book This Caregiver
            </button>
          </div>
        </div>
      </div>

      {psw.bio && (
        <div className="profile-section">
          <h2>About</h2>
          <p className="profile-bio">{psw.bio}</p>
        </div>
      )}

      {psw.serviceType?.length > 0 && (
        <div className="profile-section">
          <h2>Service Types</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {psw.serviceType.map((st) => (
              <span key={st} className="badge badge-teal">{st}</span>
            ))}
          </div>
        </div>
      )}

      <div className="profile-section">
        <h2>Location</h2>
        <ProfileMap coordinates={psw.location?.coordinates} />
      </div>

      <div className="flex-row mt-24">
        <button className="btn btn-secondary" onClick={() => navigate(`/book/${reqId}/results`)}>
          ← Back to Results
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/psw/${pswId}/${reqId}/book`)}>
          Book This Caregiver →
        </button>
      </div>
    </div>
  );
}
