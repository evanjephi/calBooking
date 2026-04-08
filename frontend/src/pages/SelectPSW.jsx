// frontend/src/pages/SelectPSW.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { checkAvailability } from "../api/api";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function useGoogleMaps() {
  const [loaded, setLoaded] = useState(!!window.google?.maps);
  useEffect(() => {
    if (!MAPS_API_KEY || window.google?.maps) { setLoaded(!!window.google?.maps); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);
  return loaded;
}

function ResultsMap({ clientCoords, matches, hoveredId }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]); // [{ marker, pswId }]
  const clientMarkerRef = useRef(null);
  const mapsLoaded = useGoogleMaps();
  const prevDataRef = useRef(null); // track matches+clientCoords identity

  // Build / rebuild markers only when matches or clientCoords change
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || matches.length === 0) return;

    // Create map once
    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 43.6532, lng: -79.3832 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
        styles: [
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
    }
    const map = mapInstance.current;

    // Only rebuild markers if data actually changed
    const dataKey = JSON.stringify({ c: clientCoords, m: matches.map((x) => x.psw._id) });
    if (prevDataRef.current === dataKey) return;
    prevDataRef.current = dataKey;

    // Clear old markers
    markersRef.current.forEach((entry) => entry.marker.setMap(null));
    markersRef.current = [];
    if (clientMarkerRef.current) { clientMarkerRef.current.setMap(null); clientMarkerRef.current = null; }

    const bounds = new window.google.maps.LatLngBounds();

    // Client marker (teal circle)
    if (clientCoords && clientCoords.length === 2) {
      const pos = { lat: clientCoords[1], lng: clientCoords[0] };
      clientMarkerRef.current = new window.google.maps.Marker({
        position: pos, map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10, fillColor: "#5f8d7e", fillOpacity: 1,
          strokeColor: "#fff", strokeWeight: 3,
        },
        title: "Your Location", zIndex: 100,
      });
      bounds.extend(pos);
    }

    // PSW markers
    matches.forEach((m) => {
      const coords = m.psw?.location?.coordinates;
      if (!coords || coords.length < 2) return;
      const pos = { lat: coords[1], lng: coords[0] };

      const marker = new window.google.maps.Marker({
        position: pos, map,
        title: `${m.psw.firstName} ${m.psw.lastName}`,
        label: {
          text: m.psw.firstName,
          color: "#fff",
          fontSize: "11px",
          fontWeight: "bold",
        },
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          scaledSize: new window.google.maps.Size(40, 40),
          labelOrigin: new window.google.maps.Point(20, 14),
        },
        zIndex: 10,
      });

      const score = m.score * 100;
      const matchLabel = score >= 80 ? "Great match" : score >= 60 ? "Good match" : "Available";
      const content = `<div style="font-family:system-ui;font-size:13px">
        <strong>${m.psw.firstName} ${m.psw.lastName}</strong><br/>
        ${matchLabel}
        ${m.distance != null ? ` · ${m.distance.toFixed(1)} km` : ""}
      </div>`;
      const iw = new window.google.maps.InfoWindow({ content });
      marker.addListener("click", () => iw.open(map, marker));

      markersRef.current.push({ marker, pswId: m.psw._id });
      bounds.extend(pos);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      window.google.maps.event.addListenerOnce(map, "idle", () => {
        if (map.getZoom() > 14) map.setZoom(14);
      });
    }
  }, [mapsLoaded, clientCoords, matches]);

  // Update only marker icons on hover — no map rebuild, no flicker
  useEffect(() => {
    if (!mapsLoaded) return;
    markersRef.current.forEach((entry) => {
      const isHovered = hoveredId === entry.pswId;
      entry.marker.setIcon({
        url: isHovered
          ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
          : "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        scaledSize: new window.google.maps.Size(40, 40),
        labelOrigin: new window.google.maps.Point(20, 14),
      });
      entry.marker.setZIndex(isHovered ? 50 : 10);
    });
  }, [hoveredId, mapsLoaded]);

  if (!MAPS_API_KEY) return null;

  return (
    <div className="map-full-height">
      <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 500, borderRadius: "var(--radius-lg)" }} />
    </div>
  );
}

export default function SelectPSW() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [clientCoords, setClientCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    checkAvailability(id)
      .then((data) => {
        setMatches(data.topMatches || []);
        setClientCoords(data.requestLocation || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><p className="center-text">Finding available caregivers near you…</p></div>;

  return (
    <div className="page">
      <div className="step-indicator">Step 3 of 4</div>
      <h1>Choose Your Caregiver</h1>

      {error && <div className="error-banner">{error}</div>}

      {matches.length === 0 && !error && (
        <div className="card mt-20" style={{ textAlign: "center" }}>
          <p>No caregivers are available near your location right now. Try a different address or check back soon.</p>
          <button className="btn btn-secondary mt-12" onClick={() => navigate("/booking/location")}>← Change Address</button>
        </div>
      )}

      {matches.length > 0 && (
        <>
          <div className="results-header">
            <p className="results-count">
              <strong>{matches.length}</strong> caregiver{matches.length !== 1 ? "s" : ""} found near you
            </p>
            <button className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: 13 }}
              onClick={() => navigate("/booking/location")}>← Change Address</button>
          </div>

          <div className="results-layout">
            <div className="results-left">
              <div className="psw-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                {matches.map((m, idx) => {
                  const score = m.score * 100;
                  const matchLabel = score >= 80 ? "Great match" : score >= 60 ? "Good match" : "Available";
                  return (
                    <div
                      key={m.psw._id}
                      className={`psw-photo-card ${hoveredId === m.psw._id ? "psw-photo-card-active" : ""}`}
                      onMouseEnter={() => setHoveredId(m.psw._id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => navigate(`/psw/${m.psw._id}/${id}`)}
                    >
                      {idx === 0 && <div className="psw-recommend-badge">We recommend</div>}
                      <div className="psw-photo-wrapper">
                        <img
                          src={m.psw.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.psw.firstName + "+" + m.psw.lastName)}&size=256&background=5f8d7e&color=fff`}
                          alt={`${m.psw.firstName} ${m.psw.lastName}`}
                        />
                      </div>
                      <div className="psw-photo-info">
                        <h3>{m.psw.firstName} {m.psw.lastName}</h3>
                        <p className="psw-meta">{matchLabel}</p>
                        {m.distance != null && (
                          <p className="psw-distance">{m.distance.toFixed(1)} km away</p>
                        )}
                        {m.psw.yearsExperience && (
                          <p className="psw-distance">{m.psw.yearsExperience} year{m.psw.yearsExperience !== 1 ? "s" : ""} experience</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="results-right">
              <ResultsMap clientCoords={clientCoords} matches={matches} hoveredId={hoveredId} />
              <div className="map-legend mt-8" style={{ justifyContent: "center", border: "none", padding: "8px 0" }}>
                <span className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: "#5f8d7e" }} /> You
                </span>
                <span className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: "#e53e3e" }} /> Caregivers
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}