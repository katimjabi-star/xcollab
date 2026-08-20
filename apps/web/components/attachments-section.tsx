"use client";

import { useEffect, useRef, useState } from "react";
/* Compact one-line import/JSX rules below are deliberate: sprint component
   files honor the repo-wide 300-line lint budget. */
import { ChevronDown, ChevronRight, Download, FileArchive, FileText, Paperclip, Trash2 } from "lucide-react";
import { Image as ImageIcon, type LucideIcon } from "lucide-react";
import { API_BASE, ApiError, WORKSPACE } from "../lib/api-client.ts";
import { ATTACHMENT_MAX_BYTES, deleteAttachment, fetchAttachmentBlob, listAttachments } from "../lib/api-attachments.ts";
import { setAttachmentsAuthTokenProvider, uploadAttachment, type Attachment } from "../lib/api-attachments.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { useAuth } from "../lib/auth-context.tsx";
import { useToasts } from "../lib/toast-context.tsx";
import { Avatar } from "./ui/avatar.tsx";
import { Icon } from "./ui/icon.tsx";
import { Skeleton } from "./ui/skeleton.tsx";

/** Same arm/disarm window as the task-panel and team-card deletes. */
const DISARM_MS = 3000;

function isImage(attachment: Attachment): boolean {
  return attachment.contentType.startsWith("image/");
}

function fileGlyph(contentType: string): LucideIcon {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (/zip|tar|gzip|compressed|x-7z|x-rar/.test(contentType)) return FileArchive;
  return FileText;
}

/** "812 B" / "34.2 KB" / "3.1 MB" — enough precision for a 25MB cap. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentsSectionProps {
  programId: string;
  /** Task scope; omit for the program-level Documents list (scope=program). */
  taskId?: string;
  uiLanguage: UiLanguage;
  /** Already-translated section heading (t.attachmentsHeading / t.documentsHeading). */
  heading: string;
  /** Program documents render as a collapsible section (default open). */
  collapsible?: boolean;
  /** Fires after a successful upload/delete so the host can refresh
      ledger-derived UI (the task panel's activity feed). */
  onChanged?: () => void;
}

/**
 * Shared attachments list: upload (hidden file input), 32px rows with type
 * glyph / name / size / uploader / download / two-step delete, skeleton row
 * while uploading, lightbox for images. Bearer-authed content means every
 * download and preview goes through fetch + blob: URLs.
 */
export function AttachmentsSection({
  programId,
  taskId,
  uiLanguage,
  heading,
  collapsible = false,
  onChanged,
}: AttachmentsSectionProps) {
  const t = STRINGS[uiLanguage];
  const { getToken } = useAuth();
  const { push } = useToasts();
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(true);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Register the Bearer source BEFORE the first fetch fires (same effect).
    setAttachmentsAuthTokenProvider(getToken);
    let cancelled = false;
    listAttachments(API_BASE, { workspaceId: WORKSPACE, programId, taskId })
      .then((list) => {
        if (!cancelled) {
          setAttachments(list);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true); // fail-soft while the API isn't live
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, programId, taskId]);

  // Escape closes the lightbox; the blob URL is revoked on every close path.
  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      URL.revokeObjectURL(lightbox.url);
    };
  }, [lightbox]);

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const onFilePicked = (file: File | null) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file || uploading) return;
    if (file.size > ATTACHMENT_MAX_BYTES) {
      push({ message: t.attachmentTooLarge });
      return;
    }
    setUploading(true);
    uploadAttachment(API_BASE, { workspaceId: WORKSPACE, programId, taskId, file })
      .then((attachment) => {
        setAttachments((prev) => [...(prev ?? []), attachment]);
        setLoadError(false);
        push({ message: t.attachmentUploaded });
        onChanged?.();
      })
      .catch((cause: unknown) => {
        const tooLarge = cause instanceof ApiError && cause.status === 413;
        push({ message: tooLarge ? t.attachmentTooLarge : t.actionFailed });
      })
      .finally(() => setUploading(false));
  };

  const download = (attachment: Attachment) => {
    fetchAttachmentBlob(API_BASE, { workspaceId: WORKSPACE, attachmentId: attachment.id })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = attachment.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  const preview = (attachment: Attachment) => {
    fetchAttachmentBlob(API_BASE, { workspaceId: WORKSPACE, attachmentId: attachment.id })
      .then((blob) => {
        setLightbox({ url: URL.createObjectURL(blob), name: attachment.filename });
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  const remove = (attachment: Attachment) => {
    if (armedId !== attachment.id) {
      setArmedId(attachment.id);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmedId(null), DISARM_MS);
      return;
    }
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmedId(null);
    deleteAttachment(API_BASE, { workspaceId: WORKSPACE, attachmentId: attachment.id })
      .then(() => {
        setAttachments((prev) => prev?.filter((item) => item.id !== attachment.id) ?? prev);
        push({ message: t.attachmentDeleted });
        onChanged?.();
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  const rows = attachments ?? [];
  const empty = attachments !== null && rows.length === 0 && !uploading;

  return (
    <section className="panel-section attachments-section">
      <div className="attachments-head">
        {collapsible ? (
          <button
            type="button"
            className="attachments-toggle"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <Icon icon={open ? ChevronDown : ChevronRight} size={14} directional={!open} />
            <span className="panel-section-label">{heading}</span>
            {rows.length > 0 ? <span className="attachments-count num">{rows.length}</span> : null}
          </button>
        ) : (
          <h3 className="panel-section-label">{heading}</h3>
        )}
        <button
          type="button"
          className="panel-icon-btn attachments-upload"
          aria-label={t.uploadFile}
          title={t.uploadFile}
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Icon icon={Paperclip} size={14} />
        </button>
        <input
          ref={fileInput}
          type="file"
          style={{ display: "none" }}
          aria-hidden
          tabIndex={-1}
          onChange={(event) => onFilePicked(event.target.files?.[0] ?? null)}
        />
      </div>

      {open ? (
        <>
          {loadError ? (
            <p className="error-note" role="alert">
              {t.loadFailed}
            </p>
          ) : null}
          {empty && !loadError ? <p className="attachments-empty">{t.attachmentsEmpty}</p> : null}
          {rows.length > 0 || uploading ? (
            <AttachmentList
              rows={rows}
              uploading={uploading}
              armedId={armedId}
              onDownload={download}
              onPreview={preview}
              onRemove={remove}
              t={t}
            />
          ) : null}
        </>
      ) : null}

      {lightbox ? (
        <div
          className="attachment-lightbox"
          role="dialog"
          aria-label={t.imagePreviewLabel}
          onClick={() => setLightbox(null)}
        >
          {/* Plain <img>: blob: URLs of bearer-fetched bytes — next/image can't optimize these. */}
          <img src={lightbox.url} alt={lightbox.name} />
        </div>
      ) : null}
    </section>
  );
}

interface AttachmentListProps {
  rows: Attachment[];
  uploading: boolean;
  armedId: string | null;
  onDownload: (attachment: Attachment) => void;
  onPreview: (attachment: Attachment) => void;
  onRemove: (attachment: Attachment) => void;
  t: (typeof STRINGS)["en"];
}

/** 32px rows: image rows open the lightbox on click; every row carries
    hover-revealed download + two-step-armed delete actions. The uploading
    skeleton row matches the final row metrics (no layout shift). */
function AttachmentList({
  rows,
  uploading,
  armedId,
  onDownload,
  onPreview,
  onRemove,
  t,
}: AttachmentListProps) {
  return (
    <ul className="attachment-rows">
      {rows.map((attachment) => (
        <li className="attachment-row" key={attachment.id}>
          {isImage(attachment) ? (
            <button
              type="button"
              className="attachment-main"
              title={t.imagePreviewLabel}
              onClick={() => onPreview(attachment)}
            >
              <AttachmentMeta attachment={attachment} />
            </button>
          ) : (
            <div className="attachment-main">
              <AttachmentMeta attachment={attachment} />
            </div>
          )}
          <div className="attachment-actions">
            <button
              type="button"
              className="panel-icon-btn"
              aria-label={`${t.downloadFile} — ${attachment.filename}`}
              title={t.downloadFile}
              onClick={() => onDownload(attachment)}
            >
              <Icon icon={Download} size={14} />
            </button>
            <button
              type="button"
              className={`panel-icon-btn panel-delete-btn${armedId === attachment.id ? " armed" : ""}`}
              aria-label={armedId === attachment.id ? t.confirmDelete : t.deleteFile}
              title={armedId === attachment.id ? t.confirmDelete : t.deleteFile}
              onClick={() => onRemove(attachment)}
            >
              <Icon icon={Trash2} size={14} />
            </button>
          </div>
        </li>
      ))}
      {uploading ? (
        <li className="attachment-row attachment-uploading">
          <Skeleton width="16px" height="16px" radius="4px" label={t.skeletonLoading} />
          <Skeleton width="45%" height="13px" />
          <Skeleton width="44px" height="12px" />
        </li>
      ) : null}
    </ul>
  );
}

/** 32px row body: type glyph, 13px truncated name, 12px size, 16px uploader. */
function AttachmentMeta({ attachment }: { attachment: Attachment }) {
  return (
    <>
      <Icon icon={fileGlyph(attachment.contentType)} size={16} className="attachment-glyph" />
      <span className="attachment-name" dir="auto" title={attachment.filename}>
        {attachment.filename}
      </span>
      {/* Numeric size keeps LTR order ("40 B") inside RTL rows. */}
      <span className="attachment-size num" dir="ltr">{humanSize(attachment.sizeBytes)}</span>
      <Avatar name={attachment.uploadedBy} size={16} title={attachment.uploadedBy} />
    </>
  );
}
