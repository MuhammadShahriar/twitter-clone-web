"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  removeAvatar,
  updateProfile,
  uploadAvatar,
  type UserDto,
  type UserProfile,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Avatar } from "@/components/Avatar";
import { IconCamera, IconClose } from "@/components/icons";
import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_ACCEPT_ATTR,
  MAX_IMAGE_BYTES,
} from "@/lib/useImageAttachments";

const NAME_MAX = 100;
const BIO_MAX = 280;

function validateImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return "Only JPEG, PNG, WebP or GIF images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "The image must be 5 MB or smaller.";
  }
  return null;
}

/**
 * Edit-profile modal (Module 4C). Edits displayName + bio and the avatar, then
 * commits on Save across up to two 4A endpoints (PUT /users/me and the avatar
 * POST/DELETE). Handles partial failure: a persisted text change is applied to
 * the header and its baseline synced, so a retry only re-runs the failed leg.
 */
export function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSaved: (updated: UserDto) => void;
}) {
  const { showToast } = useToast();
  const bioId = useId();

  const [name, setName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  // Baselines = last server-synced values; drive change-detection and let a
  // retry after a partial failure skip a leg that already succeeded.
  const [savedName, setSavedName] = useState(profile.displayName);
  const [savedBio, setSavedBio] = useState(profile.bio ?? "");

  // Server's current avatar (updated after a successful avatar save).
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(profile.avatarUrl);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // Tracks the live object URL so we can revoke it (replace/cancel/unmount)
  // without putting URL.createObjectURL inside a setState updater (StrictMode-safe).
  const pickedUrlRef = useRef<string | null>(null);

  // Scroll-lock the page behind the modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Focus the first field on open.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Safety net: revoke any live preview URL on unmount.
  useEffect(() => {
    return () => {
      if (pickedUrlRef.current) URL.revokeObjectURL(pickedUrlRef.current);
    };
  }, []);

  function revokePicked() {
    if (pickedUrlRef.current) {
      URL.revokeObjectURL(pickedUrlRef.current);
      pickedUrlRef.current = null;
    }
  }

  function handleClose() {
    if (saving) return;
    revokePicked();
    onClose();
  }

  // Esc closes (unless saving).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // handleClose is stable enough for this lifetime; saving is read fresh below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const err = validateImage(file);
    if (err) {
      setAvatarError(err); // reject inline; keep the rest of the form intact
      return;
    }
    revokePicked();
    const url = URL.createObjectURL(file);
    pickedUrlRef.current = url;
    setPicked({ file, url });
    setRemoveRequested(false);
    setAvatarError(null);
  }

  function handleRemovePhoto() {
    revokePicked();
    setPicked(null);
    setRemoveRequested(true);
    setAvatarError(null);
  }

  const displayAvatar = picked?.url ?? (removeRequested ? null : currentAvatarUrl);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length === 0
      ? "Name is required."
      : trimmedName.length > NAME_MAX
        ? `Name must be ${NAME_MAX} characters or less.`
        : null;
  const bioOver = bio.length > BIO_MAX;
  const bioError = bioOver ? `Bio must be ${BIO_MAX} characters or less.` : null;
  const bioRemaining = BIO_MAX - bio.length;

  const textChanged = trimmedName !== savedName || bio !== savedBio;
  const avatarChanged = picked !== null || removeRequested;
  const canSave = !nameError && !bioError && (textChanged || avatarChanged) && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    let result: UserDto | null = null;
    try {
      if (textChanged) {
        result = await updateProfile({ displayName: trimmedName, bio });
        // Synced — a later avatar failure won't force a re-PUT on retry.
        setSavedName(trimmedName);
        setSavedBio(bio);
      }
      if (picked) {
        result = await uploadAvatar(picked.file);
      } else if (removeRequested) {
        result = await removeAvatar();
      }

      if (result) onSaved(result);
      revokePicked();
      showToast("Profile updated.");
      onClose();
    } catch (err) {
      // Partial success: if `result` is set the text leg already persisted, so
      // apply it to the header (don't lose it) and keep the modal open to retry
      // the avatar; otherwise surface the actual error.
      if (result) {
        onSaved(result);
        setCurrentAvatarUrl(result.avatarUrl);
        showToast("Saved your details, but the photo couldn't be updated. Try again.");
      } else {
        showToast(err instanceof Error ? err.message : "Couldn't save your changes.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="modal edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
      >
        <header className="modal-head">
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            disabled={saving}
            aria-label="Close"
          >
            <IconClose size={20} />
          </button>
          <h2 id="edit-profile-title" className="modal-title">
            Edit profile
          </h2>
          <button
            type="button"
            className="modal-save"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </header>

        <div className="modal-body">
          <div className="edit-avatar">
            <Avatar
              seed={profile.handle}
              name={trimmedName || profile.displayName}
              src={displayAvatar}
              className="edit-pic"
            />
            <button
              type="button"
              className="edit-avatar-cam"
              aria-label="Change photo"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
            >
              <IconCamera size={22} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT_ATTR}
              hidden
              onChange={onPickFile}
            />
          </div>

          <div className="edit-avatar-row">
            <button
              type="button"
              className="link-btn"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
            >
              Change photo
            </button>
            {displayAvatar && (
              <button
                type="button"
                className="link-btn danger"
                onClick={handleRemovePhoto}
                disabled={saving}
              >
                Remove photo
              </button>
            )}
          </div>
          {avatarError && (
            <p className="modal-error" role="alert">
              {avatarError}
            </p>
          )}

          <label className="edit-field">
            <span className="edit-label">Name</span>
            <input
              ref={nameRef}
              className={`edit-input ${nameError ? "invalid" : ""}`}
              value={name}
              maxLength={NAME_MAX + 10}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameError}
            />
            {nameError && (
              <span className="modal-error" role="alert">
                {nameError}
              </span>
            )}
          </label>

          <label className="edit-field" htmlFor={bioId}>
            <span className="edit-label">
              Bio
              <span className={`edit-counter ${bioOver ? "over" : ""}`}>
                {bioRemaining}
              </span>
            </span>
            <textarea
              id={bioId}
              className={`edit-input edit-textarea ${bioError ? "invalid" : ""}`}
              value={bio}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              aria-invalid={!!bioError}
            />
            {bioError && (
              <span className="modal-error" role="alert">
                {bioError}
              </span>
            )}
          </label>
        </div>
      </div>
    </div>
  );
}
