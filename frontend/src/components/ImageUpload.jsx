import { useState, useRef } from "react";
import { uploadImage, imageUrl } from "../api/api";

export default function ImageUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const data = await uploadImage(file);
      onChange(data._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-upload">
      {value && (
        <div className="image-upload-preview">
          <img src={imageUrl(value)} alt="Preview" />
          <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      )}
      {!value && (
        <div className="image-upload-area" onClick={() => inputRef.current?.click()}>
          {uploading ? "Uploading…" : "Click to upload image"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </div>
      )}
      {error && <p className="error-banner">{error}</p>}
    </div>
  );
}
