import { DOCUMENT_FILE_TYPES, MAX_DOCUMENT_FILE_BYTES } from "@automate/shared";
import { useQuery } from "@tanstack/react-query";
import {
  CircleAlert,
  FileText,
  Image,
  MoreVertical,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { normalizeApiError } from "@/lib/api-error";
import { formatFileSize } from "@/utils/format";

export type AttachmentItem = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  /** The API keeps a small preview (`onPreview` links it). */
  thumbnail?: boolean;
  /** e.g. "Receipt for Toll · ₹320". */
  note?: string | null;
};

type Pending = { key: string; name: string; error?: string };

// Browsers can't draw HEIC: those show an icon.
const previewable = (type: string) => type.startsWith("image/") && type !== "image/heic";
const LINK_STALE_MS = 4 * 60 * 1000;

/**
 * Stitch "Trip Details — Photos & Receipts": a record's photos and receipts. Files go straight to
 * private storage through the module's own upload (announce, PUT, confirm); type and size are
 * checked here first and again by the API. Shared by every module that keeps files.
 */
export function AttachmentsPanel({
  title,
  items,
  max,
  readOnly = false,
  error,
  onUpload,
  onOpen,
  onPreview = onOpen,
  onRemove,
}: {
  title: string;
  items: AttachmentItem[] | undefined;
  max: number;
  readOnly?: boolean;
  /** Why the list couldn't load (shown instead of it). */
  error?: string | null;
  onUpload: (file: File) => Promise<unknown>;
  /** A short-lived link to the file. */
  onOpen: (item: AttachmentItem) => Promise<string>;
  /** A short-lived link to draw the tile with (a small preview when there is one). */
  onPreview?: (item: AttachmentItem) => Promise<string>;
  onRemove: (item: AttachmentItem) => Promise<unknown>;
}) {
  const inputId = useId();
  const [pending, setPending] = useState<Pending[]>([]);
  const [removing, setRemoving] = useState<AttachmentItem | null>(null);
  const count = items?.length ?? 0;
  const uploading = pending.some((item) => !item.error);
  // Photos as thumbnails, PDFs (and HEIC, which browsers can't draw) as rows.
  const photos = (items ?? []).filter((item) => previewable(item.contentType));
  const papers = (items ?? []).filter((item) => !previewable(item.contentType));

  const upload = async (files: File[]) => {
    const room = Math.max(0, max - count - pending.filter((item) => !item.error).length);
    for (const [index, file] of files.entries()) {
      const key = `${file.name}-${file.size}-${Date.now()}-${index}`;
      const problem =
        index >= room
          ? `Up to ${max} files`
          : !(DOCUMENT_FILE_TYPES as readonly string[]).includes(file.type)
            ? "Use a PDF, JPEG, PNG, WebP or HEIC file"
            : file.size > MAX_DOCUMENT_FILE_BYTES
              ? "Use a file of 10 MB or less"
              : undefined;
      setPending((current) => [...current, { key, name: file.name, error: problem }]);
      if (problem) continue;
      try {
        await onUpload(file);
        setPending((current) => current.filter((item) => item.key !== key));
      } catch (failure) {
        const error = normalizeApiError(failure);
        setPending((current) =>
          current.map((item) =>
            item.key === key
              ? { ...item, error: Object.values(error.fieldErrors)[0] ?? error.message }
              : item,
          ),
        );
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          {title}
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {count} of {max}
          </span>
        </CardTitle>
        {!readOnly && (
          <Button variant="outline" size="sm" asChild disabled={count >= max}>
            <label htmlFor={inputId} className="cursor-pointer">
              {uploading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              Upload
              <input
                id={inputId}
                type="file"
                multiple
                accept={DOCUMENT_FILE_TYPES.join(",")}
                className="sr-only"
                disabled={count >= max}
                aria-label={`Upload ${title.toLowerCase()}`}
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  event.target.value = "";
                  void upload(files);
                }}
              />
            </label>
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && !items ? (
          <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
            <CircleAlert className="size-4" aria-hidden />
            {error}
          </p>
        ) : !items ? (
          <Skeleton className="h-24 rounded-lg" aria-label={`Loading ${title.toLowerCase()}`} />
        ) : items.length === 0 && pending.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Paperclip className="size-4" aria-hidden />
            Nothing attached yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3" role="list" aria-label={title}>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((item) => (
                  <div key={item.id} role="listitem">
                    <Tile
                      item={item}
                      readOnly={readOnly}
                      onOpen={onOpen}
                      onPreview={onPreview}
                      onRemove={setRemoving}
                    />
                  </div>
                ))}
              </div>
            )}
            {papers.map((item) => (
              <div key={item.id} role="listitem">
                <Row item={item} readOnly={readOnly} onOpen={onOpen} onRemove={setRemoving} />
              </div>
            ))}
            {pending.map((item) => (
              <div
                key={item.key}
                role="listitem"
                className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm"
              >
                {item.error ? (
                  <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
                ) : (
                  <Spinner />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span
                    className={`block text-xs ${item.error ? "text-destructive" : "text-muted-foreground"}`}
                    role={item.error ? "alert" : undefined}
                  >
                    {item.error ?? "Uploading…"}
                  </span>
                </span>
                {item.error && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Dismiss ${item.name}`}
                    onClick={() =>
                      setPending((current) => current.filter((row) => row.key !== item.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          PDF, JPEG, PNG, WebP or HEIC, up to 10 MB each. Files are private to you.
        </p>
      </CardContent>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete ${removing?.fileName ?? "this file"}?`}
        description="It's removed from storage too. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (removing) await onRemove(removing);
        }}
      />
    </Card>
  );
}

function Tile({
  item,
  readOnly,
  onOpen,
  onPreview,
  onRemove,
}: {
  item: AttachmentItem;
  readOnly: boolean;
  onOpen: (item: AttachmentItem) => Promise<string>;
  onPreview: (item: AttachmentItem) => Promise<string>;
  onRemove: (item: AttachmentItem) => void;
}) {
  const image = previewable(item.contentType);
  const [broken, setBroken] = useState(false);
  // A thumbnail needs a link; links last a few minutes, so they're reused for less.
  const preview = useQuery({
    queryKey: ["attachment-link", item.id],
    queryFn: () => onPreview(item),
    enabled: image,
    staleTime: LINK_STALE_MS,
  });
  const open = async () => {
    const url = await onOpen(item);
    window.open(url, "_blank", "noopener,noreferrer");
  };
  const Icon = item.contentType.startsWith("image/") ? Image : FileText;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-muted/30">
      <button
        type="button"
        onClick={() => void open()}
        className="flex aspect-[4/3] items-center justify-center bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Open ${item.fileName}`}
      >
        {image && preview.data && !broken ? (
          <img
            src={preview.data}
            alt=""
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <Icon className="size-8 text-muted-foreground" aria-hidden />
        )}
      </button>
      <div className="flex items-start gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatFileSize(item.size)}</p>
          {item.note && (
            <Badge variant="secondary" className="mt-1.5 max-w-full truncate">
              {item.note}
            </Badge>
          )}
        </div>
        <FileMenu item={item} readOnly={readOnly} open={open} onRemove={onRemove} />
      </div>
    </div>
  );
}

function Row({
  item,
  readOnly,
  onOpen,
  onRemove,
}: {
  item: AttachmentItem;
  readOnly: boolean;
  onOpen: (item: AttachmentItem) => Promise<string>;
  onRemove: (item: AttachmentItem) => void;
}) {
  const open = async () => window.open(await onOpen(item), "_blank", "noopener,noreferrer");
  const Icon = item.contentType.startsWith("image/") ? Image : FileText;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <button
        type="button"
        onClick={() => void open()}
        className="min-w-0 flex-1 text-left focus-visible:underline focus-visible:outline-none"
        aria-label={`Open ${item.fileName}`}
      >
        <span className="block truncate text-sm font-medium">{item.fileName}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {formatFileSize(item.size)}
        </span>
      </button>
      {item.note && (
        <Badge variant="secondary" className="max-w-[45%] truncate max-sm:hidden">
          {item.note}
        </Badge>
      )}
      <FileMenu item={item} readOnly={readOnly} open={open} onRemove={onRemove} />
    </div>
  );
}

function FileMenu({
  item,
  readOnly,
  open,
  onRemove,
}: {
  item: AttachmentItem;
  readOnly: boolean;
  open: () => Promise<unknown>;
  onRemove: (item: AttachmentItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.fileName}`}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void open()}>
          <FileText />
          Open
        </DropdownMenuItem>
        {!readOnly && (
          <DropdownMenuItem variant="destructive" onSelect={() => onRemove(item)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
