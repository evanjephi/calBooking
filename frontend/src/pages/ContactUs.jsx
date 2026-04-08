import { useState, useEffect } from "react";
import { getPublicPage } from "../api/api";

export default function ContactUs() {
  const [page, setPage] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getPublicPage("contact-us").then(setPage).catch(() => {});
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="public-page">
      <div className="public-hero">
        <h1>We're Here to Help!</h1>
        <p>Have questions or need assistance? Our team is always ready to support you.</p>
      </div>
      <div className="public-content">
        {page?.body && <div dangerouslySetInnerHTML={{ __html: page.body }} style={{ marginBottom: 32 }} />}

        <div className="contact-form-wrap">
          <h2>Contact Form: <span style={{ fontWeight: 400 }}>For general inquiries and support requests</span></h2>

          {submitted ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <h3>Thank you!</h3>
              <p>Your message has been sent. We'll get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Your Name</label>
                <input className="form-input" placeholder="Enter your full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Your Email</label>
                <input type="email" className="form-input" placeholder="Enter your email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input className="form-input" placeholder="What is this regarding?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea className="form-input" rows={5} placeholder="Tell us more about how we can help you…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-teal btn-block">Send Message</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
