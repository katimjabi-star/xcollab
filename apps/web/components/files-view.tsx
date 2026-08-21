"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, LayoutGrid, ListFilter, Plus, StretchHorizontal } from "lucide-react";
import { API_BASE, ApiError, WORKSPACE } from "../lib/api-client.ts";
import { ATTACHMENT_MAX_BYTES, fetchAttachmentBlob, setAttachmentsAuthTokenProvider } from "../lib/api-attachments.ts";
import { uploadAttachment, type Attachment } from "../lib/api-attachments.ts";
import { STRINGS, type UiLanguage } from "../lib/i18n.ts";
import { useAuth } from "../lib/auth-context.tsx";
import { useToasts } from "../lib/toast-context.tsx";
import { Avatar } from "./ui/avatar.tsx";
import { Icon } from "./ui/icon.tsx";
import { Popover } from "./ui/popover.tsx";
import { Skeleton } from "./ui/skeleton.tsx";
import { FileTile, FilesEmptyState, fileGlyph, humanSize, isImage, useImageThumbs } from "./browse-file-tile.tsx";

type Strings = (typeof STRINGS)["en"];
type TypeFilter = "all" | "images" | "docs";
type FileSort = "date" | "name" | "size";

/** WHOLE-program attachment list — program-scope docs AND every task's files.
    The API returns exactly that when neither taskId nor scope=program is sent
    (routes-attachments.ts); lib/api-attachments' listAttachments always pins
    one scope, so this view carries its own bearer fetch for the union. */
async function listAllAttachments(
  programId: string,
  getToken: () => string | null,
): Promise<Attachment[]> {
  const params = new URLSearchParams({ workspaceId: WORKSPACE, programId });
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const url = `${API_BASE}/api/attachments?${params.toString()}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new ApiError(response.status, `GET ${url} → ${response.status}`);
  return ((await response.json()) as { attachments: Attachment[] }).attachments;
}

function applyView(rows: Attachment[], type: TypeFilter, sort: FileSort): Attachment[] {
  const filtered = rows.filter((row) =>
    type === "all" ? true : type === "images" ? isImage(row) : !isImage(row),
  );
  return [...filtered].sort((a, b) => {
    if (sort === "name") return a.filename.localeCompare(b.filename);
    if (sort === "size") return b.sizeBytes - a.sizeBytes;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

/** One right-cluster popover (Filter / Sort): radio option list. */
function ToolMenu<V extends string>({
  icon,
  label,
  active,
  value,
  options,
  onPick,
}: {
  icon: typeof ListFilter;
  label: string;
  active: boolean;
  value: V;
  options: { id: V; label: string }[];
  onPick: (id: V) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="end"
      role="menu"
      anchor={
        <button
          type="button"
          className={`files-tool-btn${active ? " active" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Icon icon={icon} size={14} />
          {label}
        </button>
      }
    >
      <div className="browse-chip-menu">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitemradio"
            aria-checked={value === option.id}
            className="browse-chip-option"
            onClick={() => {
              onPick(option.id);
              setOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}

/** Files tab for a program: every attachment in the project (program docs +
    task files), grid/list toggle, type filter, sort, program-scope upload. */
export function FilesView({ programId, uiLanguage }: { programId: string; uiLanguage: UiLanguage }) {
  const t: Strings = STRINGS[uiLanguage];
  const { getToken } = useAuth();
  const { push } = useToasts();
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<FileSort>("date");
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAttachmentsAuthTokenProvider(getToken); // before the upload path runs
    let cancelled = false;
    listAllAttachments(programId, getToken)
      .then((list) => {
        if (!cancelled) {
          setAttachments(list);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, programId]);

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

  const rows = applyView(attachments ?? [], type, sort);
  const thumbs = useImageThumbs(mode === "grid" ? rows : []);

  const onFilePicked = (file: File | null) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file || uploading) return;
    if (file.size > ATTACHMENT_MAX_BYTES) {
      push({ message: t.attachmentTooLarge });
      return;
    }
    setUploading(true);
    uploadAttachment(API_BASE, { workspaceId: WORKSPACE, programId, file })
      .then((attachment) => {
        setAttachments((prev) => [...(prev ?? []), attachment]);
        push({ message: t.attachmentUploaded });
      })
      .catch((cause: unknown) => {
        const tooLarge = cause instanceof ApiError && cause.status === 413;
        push({ message: tooLarge ? t.attachmentTooLarge : t.actionFailed });
      })
      .finally(() => setUploading(false));
  };

  /** Images open in the lightbox; anything else downloads. */
  const open = (attachment: Attachment) => {
    fetchAttachmentBlob(API_BASE, { workspaceId: WORKSPACE, attachmentId: attachment.id })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (isImage(attachment)) {
          setLightbox({ url, name: attachment.filename });
          return;
        }
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = attachment.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => push({ message: t.actionFailed }));
  };

  const empty = attachments !== null && attachments.length === 0 && !uploading;

  return (
    <div className="files-view">
      <div className="files-toolbar">
        <button
          type="button"
          className="files-add-btn"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Icon icon={Plus} size={14} />
          {t.filesAddFile}
        </button>
        <input
          ref={fileInput}
          type="file"
          style={{ display: "none" }}
          aria-hidden
          tabIndex={-1}
          onChange={(event) => onFilePicked(event.target.files?.[0] ?? null)}
        />
        <div className="files-toolbar-end">
          <ToolMenu
            icon={ListFilter}
            label={t.filterLabel}
            active={type !== "all"}
            value={type}
            options={[
              { id: "all", label: t.filesFilterAllTypes },
              { id: "images", label: t.filesFilterImages },
              { id: "docs", label: t.filesFilterDocs },
            ]}
            onPick={setType}
          />
          <ToolMenu
            icon={ArrowUpDown}
            label={t.sortLabel}
            active={sort !== "date"}
            value={sort}
            options={[
              { id: "date", label: t.filesSortDate },
              { id: "name", label: t.sortName },
              { id: "size", label: t.filesSortSize },
            ]}
            onPick={setSort}
          />
          <div className="files-mode" role="group" aria-label={t.viewSwitcherLabel}>
            <button type="button" aria-pressed={mode === "grid"} aria-label={t.filesGridView} title={t.filesGridView} onClick={() => setMode("grid")}>
              <Icon icon={LayoutGrid} size={14} />
            </button>
            <button type="button" aria-pressed={mode === "list"} aria-label={t.filesListView} title={t.filesListView} onClick={() => setMode("list")}>
              <Icon icon={StretchHorizontal} size={14} />
            </button>
          </div>
        </div>
      </div>

      {loadError ? <p className="error-note" role="alert">{t.loadFailed}</p> : null}
      {attachments === null && !loadError ? (
        <div className="files-loading">
          <Skeleton width="200px" height="13px" label={t.skeletonLoading} />
        </div>
      ) : null}
      {empty && !loadError ? <FilesEmptyState caption={t.filesEmptyCaption} /> : null}

      {rows.length > 0 && mode === "grid" ? (
        <div className="files-grid">
          {rows.map((attachment) => (
            <FileTile
              key={attachment.id}
              attachment={attachment}
              thumbUrl={thumbs.get(attachment.id) ?? null}
              onOpen={open}
              openLabel={isImage(attachment) ? t.imagePreviewLabel : t.downloadFile}
            />
          ))}
        </div>
      ) : null}
      {rows.length > 0 && mode === "list" ? (
        <ul className="files-rows">
          {rows.map((attachment) => (
            <li key={attachment.id}>
              <button type="button" className="files-row" onClick={() => open(attachment)}>
                <Icon icon={fileGlyph(attachment.contentType)} size={16} className="files-row-glyph" />
                <span className="files-row-name" dir="auto">{attachment.filename}</span>
                <span className="files-row-size num" dir="ltr">{humanSize(attachment.sizeBytes)}</span>
                <Avatar name={attachment.uploadedBy} size={16} title={attachment.uploadedBy} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {lightbox ? (
        /* Plain <img>: blob: URL of bearer-fetched bytes. */
        <div className="attachment-lightbox" role="dialog" aria-label={t.imagePreviewLabel} onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.name} />
        </div>
      ) : null}
    </div>
  );
}
