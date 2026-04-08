import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const userData = await login(email, password);
      // Role-based redirect
      if (userData?.role === "admin") {
        navigate("/admin");
      } else if (userData?.role === "psw") {
        navigate("/dashboard");
      } else {
        navigate("/find-psw");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 400, margin: "0 auto" }}>
      <h1>Sign In</h1>
      <form onSubmit={handleSubmit} className="gap-12 mt-20">
        <div className="form-group">
          <label>Email</label>
          <input className="form-input" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input className="form-input" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <p style={{ marginTop: 16, textAlign: "center" }}>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
      <p style={{ textAlign: "center", fontSize: 14, color: "var(--muted)" }}>
        Are you a PSW? <Link to="/register/psw">Register as a provider</Link>
      </p>
    </div>
  );
}