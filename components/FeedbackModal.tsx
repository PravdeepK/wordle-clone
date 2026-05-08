"use client";

import { useEffect, useRef, useState } from "react";

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
  defaultIdentifier?: string;
};

const CATEGORIES = ["Bug", "Suggestion", "Question", "Other"] as const;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 5;

export default function FeedbackModal({ open, onClose, defaultIdentifier = "" }: FeedbackModalProps) {
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Bug");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setIdentifier(defaultIdentifier);
      setCategory("Bug");
      setMessage("");
      setFiles([]);
      setError("");
      setTicketId(null);
    }
  }, [open, defaultIdentifier]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  const handleFilesAdded = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) break;
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) continue;
      next.push(f);
    }
    const newTotal = next.reduce((sum, f) => sum + f.size, 0);
    if (newTotal > MAX_TOTAL_BYTES) {
      setError("Attachments exceed 15MB total. Remove some files.");
      return;
    }
    setError("");
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    if (!identifier.trim()) {
      setError("Please enter your username or email.");
      return;
    }
    if (!message.trim()) {
      setError("Please describe the issue.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("identifier", identifier.trim());
      fd.append("category", category);
      fd.append("message", message.trim());
      for (const f of files) fd.append("attachments", f);

      const res = await fetch("/api/feedback", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ticketId?: string; error?: string };
      if (!res.ok) {
        setError(data.error || "Failed to submit feedback.");
        return;
      }
      setTicketId(data.ticketId ?? "submitted");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="feedback-overlay" role="dialog" aria-modal="true" aria-label="Send feedback">
      <button
        type="button"
        className="feedback-backdrop"
        aria-label="Close feedback"
        onClick={onClose}
      />
      <div className="feedback-dialog">
        <button type="button" className="feedback-close" aria-label="Close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        {ticketId ? (
          <div className="feedback-success">
            <div className="feedback-success-check" aria-hidden="true">✓</div>
            <h2 className="feedback-title">Thanks for the feedback!</h2>
            <p className="feedback-success-text">
              Your ticket has been submitted. Reference ID:
            </p>
            <div className="feedback-ticket-id">{ticketId}</div>
            <button type="button" className="restart-button feedback-submit" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-form">
            <h2 className="feedback-title">Report a Bug / Send Feedback</h2>
            <p className="feedback-subtitle">
              Found something off? Let me know. Attachments are optional.
            </p>

            <label className="feedback-field">
              <span className="feedback-label">Username or email *</span>
              <input
                type="text"
                className="feedback-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                maxLength={200}
                required
              />
            </label>

            <label className="feedback-field">
              <span className="feedback-label">Category</span>
              <select
                className="feedback-input"
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="feedback-field">
              <span className="feedback-label">Describe the issue *</span>
              <textarea
                className="feedback-input feedback-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What happened? What did you expect to happen?"
                maxLength={5000}
                rows={5}
                required
              />
            </label>

            <div className="feedback-field">
              <span className="feedback-label">
                Attachments <span className="feedback-optional">(optional, images/videos, 15MB total)</span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="feedback-file-input"
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
              <button
                type="button"
                className="feedback-file-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= MAX_FILES}
              >
                {files.length >= MAX_FILES ? "Maximum files reached" : "Choose files"}
              </button>
              {files.length > 0 && (
                <ul className="feedback-file-list">
                  {files.map((f, i) => (
                    <li key={i} className="feedback-file-item">
                      <span className="feedback-file-name">{f.name}</span>
                      <span className="feedback-file-size">{formatBytes(f.size)}</span>
                      <button
                        type="button"
                        className="feedback-file-remove"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => removeFile(i)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {files.length > 0 && (
                <div className="feedback-file-total">
                  Total: {formatBytes(totalBytes)} / 15 MB
                </div>
              )}
            </div>

            {error && <p className="error-message">{error}</p>}

            <button
              type="submit"
              className="restart-button feedback-submit"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Submit"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
