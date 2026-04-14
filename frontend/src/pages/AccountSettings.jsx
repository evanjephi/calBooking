import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { updateProfile, changePassword } from "../api/api";

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();

  const [form, setForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    street: user?.address?.street || "",
    unit: user?.address?.unit || "",
    city: user?.address?.city || "",
    postalCode: user?.address?.postalCode || ""
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileMsg(""); setProfileErr("");
    setSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        address: {
          street: form.street,
          unit: form.unit,
          city: form.city,
          postalCode: form.postalCode
        }
      });
      await refreshUser();
      setProfileMsg("Profile updated successfully");
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwMsg(""); setPwErr("");
    if (pw.newPassword !== pw.confirmPassword) {
      setPwErr("New passwords do not match");
      return;
    }
    setChangingPw(true);
    try {
      await changePassword({
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword
      });
      setPwMsg("Password changed successfully");
      setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPwErr(err.message);
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="account-page">
      <h1>Account Settings</h1>

      <div className="account-section">
        <h2>Personal Information</h2>
        {profileMsg && <div className="msg-success">{profileMsg}</div>}
        {profileErr && <div className="msg-error">{profileErr}</div>}
        <form onSubmit={handleProfileSubmit} className="account-form">
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input name="firstName" value={form.firstName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input name="lastName" value={form.lastName} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Street Address</label>
            <input name="street" value={form.street} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unit</label>
              <input name="unit" value={form.unit} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input name="city" value={form.city} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Postal Code</label>
              <input name="postalCode" value={form.postalCode} onChange={handleChange} />
            </div>
          </div>
          <button type="submit" className="btn btn-teal btn-block" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="account-section">
        <h2>Change Password</h2>
        {pwMsg && <div className="msg-success">{pwMsg}</div>}
        {pwErr && <div className="msg-error">{pwErr}</div>}
        <form onSubmit={handlePasswordSubmit} className="account-form">
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} required minLength={6} />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" value={pw.confirmPassword} onChange={e => setPw({ ...pw, confirmPassword: e.target.value })} required minLength={6} />
            </div>
          </div>
          <button type="submit" className="btn btn-teal btn-block" disabled={changingPw}>
            {changingPw ? "Changing…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
