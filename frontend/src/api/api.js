// frontend/src/api/api.js
function resolveBase() {
  // 1. Explicit env var always wins
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // 2. In production, derive from current origin (assumes API is on same host, port 5000)
  if (import.meta.env.PROD) return `${window.location.origin}`;
  // 3. Dev fallback
  return "http://localhost:5000";
}
const BASE = resolveBase();

let token = localStorage.getItem("token") || "";

export function setToken(t) {
  token = t;
  localStorage.setItem("token", t);
}

export function clearToken() {
  token = "";
  localStorage.removeItem("token");
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);

  if (res.status === 401 && !path.startsWith("/auth/")) {
    clearToken();
    window.location.replace("/login");
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = new Error(data?.message || "Request failed");
    err.status = res.status;
    err.errors = data?.errors; // validation errors array
    throw err;
  }

  return data;
}

// ── Auth ──
export const register = (body) => request("POST", "/auth/register", body);
export const login = (body) => request("POST", "/auth/login", body);
export const getMe = () => request("GET", "/auth/me");
export const updateProfile = (body) => request("PUT", "/auth/profile", body);
export const changePassword = (body) => request("PUT", "/auth/password", body);

// ── Booking Request Pipeline ──
export const createBookingRequest = (body) => request("POST", "/booking-requests", body);
export const getBookingRequest = (id) => request("GET", `/booking-requests/${id}`);
export const checkAvailability = (id) => request("GET", `/booking-requests/${id}/availability`);
export const getPSWCalendar = (id, pswId) => request("GET", `/booking-requests/${id}/psw-calendar/${pswId}`);
export const saveContact = (id, body) => request("PATCH", `/booking-requests/${id}/contact`, body);
export const selectPSW = (id, body) => request("PATCH", `/booking-requests/${id}/select-psw`, body);
export const confirmRequest = (id) => request("PATCH", `/booking-requests/${id}/confirm`);
export const finalizeBooking = (id) => request("POST", `/booking-requests/${id}/finalize`);

// ── Bookings ──
export const getBookings = () => request("GET", "/bookings");
export const getBooking = (id) => request("GET", `/bookings/${id}`);
export const cancelBooking = (id) => request("DELETE", `/bookings/${id}`);
export const getTransactions = () => request("GET", "/bookings/transactions");

// ── PSW Lookup (public) ──
export const getPSWProfile = (id) => request("GET", `/psws/${id}`);
export const getPSWBookedSlots = (id, from, to) => request("GET", `/psws/${id}/booked-slots?from=${from}&to=${to}`);
export const checkPSWConflict = (id, body) => request("POST", `/psws/${id}/check-conflict`, body);
export const getCacheStats = () => request("GET", "/psws/cache/stats");
export const lookupPSWs = (postalCode) => request("GET", `/psws/cache/lookup/${encodeURIComponent(postalCode)}`);

// ── Public Posts & Pages ──
export const getPublicPosts = (category) => request("GET", `/posts${category ? `?category=${category}` : ""}`);
export const getPublicPost = (slug) => request("GET", `/posts/${slug}`);
export const getPublicPage = (slug) => request("GET", `/pages/${slug}`);

// ── Admin: Stats ──
export const getAdminStats = () => request("GET", "/admin/stats");

// ── Admin: Posts ──
export const getAdminPosts = (category) => request("GET", `/admin/posts${category ? `?category=${category}` : ""}`);
export const getAdminPost = (id) => request("GET", `/admin/posts/${id}`);
export const createAdminPost = (body) => request("POST", "/admin/posts", body);
export const updateAdminPost = (id, body) => request("PUT", `/admin/posts/${id}`, body);
export const deleteAdminPost = (id) => request("DELETE", `/admin/posts/${id}`);

// ── Admin: Pages ──
export const getAdminPages = () => request("GET", "/admin/pages");
export const getAdminPage = (id) => request("GET", `/admin/pages/${id}`);
export const createAdminPage = (body) => request("POST", "/admin/pages", body);
export const updateAdminPage = (id, body) => request("PUT", `/admin/pages/${id}`, body);
export const deleteAdminPage = (id) => request("DELETE", `/admin/pages/${id}`);

// ── Admin: Clients ──
export const getAdminClients = () => request("GET", "/admin/clients");
export const getAdminClient = (id) => request("GET", `/admin/clients/${id}`);
export const createAdminClient = (body) => request("POST", "/admin/clients", body);
export const updateAdminClient = (id, body) => request("PUT", `/admin/clients/${id}`, body);
export const deleteAdminClient = (id) => request("DELETE", `/admin/clients/${id}`);

// ── Admin: PSWs ──
export const getAdminPSWs = () => request("GET", "/admin/psws");
export const getAdminPSW = (id) => request("GET", `/admin/psws/${id}`);
export const createAdminPSW = (body) => request("POST", "/admin/psws", body);
export const updateAdminPSW = (id, body) => request("PUT", `/admin/psws/${id}`, body);
export const deleteAdminPSW = (id) => request("DELETE", `/admin/psws/${id}`);

// ── Admin: Bookings ──
export const getAdminBookings = (status) => request("GET", `/admin/bookings${status ? `?status=${status}` : ""}`);
export const getAdminBooking = (id) => request("GET", `/admin/bookings/${id}`);
export const updateAdminBooking = (id, body) => request("PUT", `/admin/bookings/${id}`, body);
export const deleteAdminBooking = (id) => request("DELETE", `/admin/bookings/${id}`);

// ── Admin: Booking Requests ──
export const getAdminBookingRequests = (status) => request("GET", `/admin/booking-requests${status ? `?status=${status}` : ""}`);
export const deleteAdminBookingRequest = (id) => request("DELETE", `/admin/booking-requests/${id}`);

// ── Admin: Users ──
export const getAdminUsers = () => request("GET", "/admin/users");
export const updateAdminUser = (id, body) => request("PUT", `/admin/users/${id}`, body);
export const deleteAdminUser = (id) => request("DELETE", `/admin/users/${id}`);

// ── Public: Service Levels ──
export const getServiceLevels = () => request("GET", "/service-levels");

// ── Admin: Service Levels ──
export const getAdminServiceLevels = () => request("GET", "/admin/service-levels");
export const createAdminServiceLevel = (body) => request("POST", "/admin/service-levels", body);
export const updateAdminServiceLevel = (id, body) => request("PUT", `/admin/service-levels/${id}`, body);
export const deleteAdminServiceLevel = (id) => request("DELETE", `/admin/service-levels/${id}`);

// ── Admin: Images ──
export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${BASE}/admin/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Upload failed");
  return data;
};
export const deleteImage = (id) => request("DELETE", `/admin/images/${id}`);
export const imageUrl = (id) => `${BASE}/images/${id}`;

// ── PSW Application ──
export const submitPSWApplication = async (formData) => {
  const res = await fetch(`${BASE}/psws/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Application submission failed");
  return data;
};
export const getPSWApplication = () => request("GET", "/psws/application");
export const getMyDocuments = () => request("GET", "/psws/application/documents");
export const addDocument = async (formData) => {
  const res = await fetch(`${BASE}/psws/application/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "Upload failed");
  return data;
};
export const removeDocument = (docId) => request("DELETE", `/psws/application/documents/${docId}`);

// ── Chat Assistant ──
export const sendChatMessage = (body) => request("POST", "/chat", body);
export const getChatHistory = (sessionId) => request("GET", `/chat/${sessionId}`);
export const clearChatSession = (sessionId) => request("DELETE", `/chat/${sessionId}`);

// ── PSW Dashboard ──
export const getPSWBookings = () => request("GET", "/bookings/psw");
export const respondToBooking = (id, status) => request("PATCH", `/bookings/${id}/respond`, { status });