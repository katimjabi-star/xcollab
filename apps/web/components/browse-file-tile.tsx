"use client";

import { useEffect, useState } from "react";
import { FileArchive, FileText, Image as ImageIcon, type LucideIcon } from "lucide-react";
import { API_BASE, WORKSPACE } from "../lib/api-client.ts";
import { fetchAttachmentBlob, type Attachment } from "../lib/api-attachments.ts";
import { Avatar } from "./ui/avatar.tsx";
import { Icon } from "./ui/icon.tsx";

/* Local re-derivations of attachments-section's module-private helpers —
   that file doesn't export them and stays untouched (not this sprint's). */

export function isImage(attachment: Attachment): boolean {
  return attachment.contentType.startsWith("image/");
}

export function fileGlyph(contentType: string): LucideIcon {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (/zip|tar|gzip|compressed|x-7z|x-rar/.test(contentType)) return FileArchive;
  return FileText;
}

/** "812 B" / "34.2 KB" / "3.1 MB" — consumers wrap it in dir="ltr" spans. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}\u00A0B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}\u00A0KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}\u00A0MB`;
}

/** blob: URLs for image attachments (bearer-authed content can't go in plain
    <img src>). Fetched once per id set; every URL is revoked on cleanup. */
export function useImageThumbs(attachments: Attachment[]): Map<string, string> {
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const key = attachments
    .filter(isImage)
    .map((a) => a.id)
    .join(",");
  useEffect(() => {
    if (!key) {
      setThumbs(new Map());
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    Promise.all(
      key.split(",").map(async (attachmentId) => {
        try {
          const blob = await fetchAttachmentBlob(API_BASE, {
            workspaceId: WORKSPACE,
            attachmentId,
          });
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return [attachmentId, url] as const;
        } catch {
          return null; // fail-soft: the tile falls back to the type glyph
        }
      }),
    ).then((pairs) => {
      if (cancelled) {
        // Cleanup already ran with an empty `urls`; these would leak.
        for (const pair of pairs) if (pair !== null) URL.revokeObjectURL(pair[1]);
        return;
      }
      setThumbs(new Map(pairs.filter((pair) => pair !== null)));
    });
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [key]);
  return thumbs;
}

/** Grid card: 16:10 preview tile (image thumb or large type glyph), truncated
    name, then a size + uploader meta line. Click opens/downloads via parent. */
export function FileTile({
  attachment,
  thumbUrl,
  onOpen,
  openLabel,
}: {
  attachment: Attachment;
  thumbUrl: string | null;
  onOpen: (attachment: Attachment) => void;
  openLabel: string;
}) {
  return (
    <button
      type="button"
      className="file-tile"
      title={`${openLabel} — ${attachment.filename}`}
      onClick={() => onOpen(attachment)}
    >
      <span className="file-tile-preview" aria-hidden>
        {thumbUrl ? (
          /* blob: URL of bearer-fetched bytes — next/image can't optimize these. */
          <img src={thumbUrl} alt="" loading="lazy" />
        ) : (
          <Icon icon={fileGlyph(attachment.contentType)} size={28} className="file-tile-glyph" />
        )}
      </span>
      <span className="file-tile-name" dir="auto">
        {attachment.filename}
      </span>
      <span className="file-tile-meta">
        <span className="num" dir="ltr">
          {humanSize(attachment.sizeBytes)}
        </span>
        <Avatar name={attachment.uploadedBy} size={16} title={attachment.uploadedBy} />
        <span className="file-tile-uploader" dir="auto">
          {attachment.uploadedBy}
        </span>
      </span>
    </button>
  );
}

/** Empty state: hand-drawn abstract docs+chart illustration, inline SVG only,
    currentColor-tinted so it holds in both themes and both languages. */
export function FilesEmptyState({ caption }: { caption: string }) {
  return (
    <div className="files-empty">
      <svg
        viewBox="0 0 160 120"
        width="160"
        height="120"
        role="presentation"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* back document card */}
        <rect x="30" y="18" width="72" height="52" rx="6" transform="rotate(-6 66 44)" />
        <line x1="42" y1="32" x2="70" y2="29" />
        <line x1="43" y1="42" x2="78" y2="38" />
        <line x1="44" y1="52" x2="64" y2="50" />
        {/* mini chart nodes on the back card */}
        <circle cx="88" cy="34" r="3.5" fill="currentColor" stroke="none" />
        <circle cx="94" cy="48" r="3.5" fill="currentColor" stroke="none" />
        <circle cx="80" cy="46" r="3.5" fill="currentColor" stroke="none" />
        <line x1="85" y1="37" x2="82" y2="43" />
        <line x1="90" y1="37" x2="93" y2="44" />
        {/* pie chart */}
        <circle cx="66" cy="88" r="16" />
        <path d="M66 88 L66 72 A16 16 0 0 1 80 80 Z" fill="currentColor" stroke="none" />
        {/* front photo card */}
        <rect x="92" y="62" width="44" height="36" rx="5" transform="rotate(8 114 80)" />
        <circle cx="106" cy="76" r="3" />
        <path d="M98 92 l10 -8 6 5 8 -7 10 8" />
      </svg>
      <p className="files-empty-caption">{caption}</p>
    </div>
  );
}
