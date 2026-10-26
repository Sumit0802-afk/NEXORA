"use client";

import { useEffect, useState } from "react";
import {
  X,
  MessageSquare,
  Bug,
  Lightbulb,
  FileText,
  Building2,
  Star,
  CheckCircle2,
  AlertCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { submitUserFeedback, captureDiagnostics, type UserFeedback } from "@/lib/telemetry";
import { useAuth } from "@/components/auth/AuthProvider";
import type { FloorPlan } from "@houseplan/design-schema";

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: FloorPlan | null;
}

export function FeedbackModal({ isOpen, onClose, plan }: FeedbackModalProps) {
  const [category, setCategory] = useState<UserFeedback["category"]>("bug");
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  // Offer the signed-in account's email for follow-up; the person can still change or clear it.
  useEffect(() => {
    if (isOpen && user?.email) setEmail((e) => e || user.email);
  }, [isOpen, user?.email]);
  const [attachDiagnostics, setAttachDiagnostics] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setErrorMsg("Please provide both a summary title and detailed feedback description.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const roomCount = plan?.levels.reduce((acc, l) => acc + l.rooms.length, 0);
      const diagnostics = attachDiagnostics
        ? captureDiagnostics({
            projectId: plan?.projectId,
            roomCount,
            levelCount: plan?.levels.length,
            units: plan?.units,
          })
        : undefined;

      await submitUserFeedback({
        category,
        rating,
        title: title.trim(),
        message: message.trim(),
        email: email.trim() || undefined,
        diagnostics,
      });

      setSubmitted(true);
    } catch (err) {
      setErrorMsg("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setTitle("");
    setMessage("");
    setEmail("");
    onClose();
  };

  const categories = [
    { id: "bug", label: "Bug Report", icon: Bug },
    { id: "feature", label: "Feature Idea", icon: Lightbulb },
    { id: "drawing_export", label: "Drawings / PDF", icon: FileText },
    { id: "structural", label: "Structural Grid", icon: Building2 },
    { id: "general", label: "General Feedback", icon: MessageSquare },
  ] as const;
  const ratingLabel = rating === 5 ? "Excellent" : rating === 4 ? "Good" : rating === 3 ? "Average" : rating === 2 ? "Needs work" : "Critical issues";

  return (
    <div className="fb-overlay" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <div className="fb-modal">
        <header className="fb-header">
          <div className="fb-title">
            <span className="fb-title-icon"><MessageSquare size={18} /></span>
            <div>
              <h2 id="fb-title">Help &amp; Feedback</h2>
              <p>Tell us what is working and what is not.</p>
            </div>
          </div>
          <button type="button" className="interior-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {submitted ? (
          <div className="fb-done">
            <span className="fb-done-icon"><CheckCircle2 size={30} /></span>
            <h3>Thank you for your feedback</h3>
            <p>Your message has been saved. We read every submission to improve drawing accuracy, performance and stability.</p>
            <button type="button" className="button primary" onClick={handleReset}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="fb-form" noValidate>
            {errorMsg && (
              <div className="auth-error fb-error" role="alert"><AlertCircle size={15} /> {errorMsg}</div>
            )}

            <fieldset className="fb-field">
              <legend>Category</legend>
              <div className="fb-cats">
                {categories.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={category === item.id}
                      className={`fb-cat${category === item.id ? " selected" : ""}`}
                      onClick={() => setCategory(item.id)}
                    >
                      <Icon size={15} /> {item.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="fb-field">
              <span className="fb-label" id="fb-rating-label">Overall experience</span>
              <div className="fb-stars" role="radiogroup" aria-labelledby="fb-rating-label">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    className={star <= rating ? "on" : ""}
                    onClick={() => setRating(star)}
                  >
                    <Star size={22} />
                  </button>
                ))}
                <span className="fb-rating-text">{ratingLabel}</span>
              </div>
            </div>

            <div className="fb-field">
              <label className="fb-label" htmlFor="fb-summary">Summary <span className="fb-req">*</span></label>
              <input id="fb-summary" className="fb-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PDF title block wraps on A4" required />
            </div>

            <div className="fb-field">
              <label className="fb-label" htmlFor="fb-message">Details or steps to reproduce <span className="fb-req">*</span></label>
              <textarea id="fb-message" className="fb-input fb-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened, what you expected, or what you need…" required />
            </div>

            <div className="fb-field">
              <label className="fb-label" htmlFor="fb-email">Email <span className="fb-opt">(optional, for follow-up)</span></label>
              <input id="fb-email" className="fb-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
            </div>

            <label className="fb-check">
              <input type="checkbox" checked={attachDiagnostics} onChange={(e) => setAttachDiagnostics(e.target.checked)} />
              <span>
                <strong><ShieldCheck size={14} /> Include anonymous diagnostics</strong>
                <small>Attaches screen size, browser version and room count to help us debug. No personal data.</small>
              </span>
            </label>

            <div className="fb-actions">
              <button type="button" className="button outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="button primary" disabled={submitting}>
                <Send size={14} /> {submitting ? "Submitting…" : "Submit feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
