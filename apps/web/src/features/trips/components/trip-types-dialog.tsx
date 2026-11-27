import { type TripCategory, tripCategoryFieldsSchema } from "@automate/shared";
import { Archive, ArchiveRestore, Check, Pencil, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { typeColor } from "@/features/trips/constants";
import {
  useArchiveTripCategory,
  useCreateTripCategory,
  useRenameTripCategory,
  useTripCategories,
} from "@/features/trips/hooks/use-trips";
import { normalizeApiError } from "@/lib/api-error";

/** The first field error of a failed save, or its message. */
const errorText = (error: unknown) => {
  const normalized = normalizeApiError(error);
  return Object.values(normalized.fieldErrors)[0] ?? normalized.message;
};

/**
 * Stitch "Trip Types Dialog": the defaults (fixed) and the user's own types, which can be added,
 * renamed, archived (trips keep them) and restored.
 */
export function TripTypesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const categories = useTripCategories().data ?? [];
  const create = useCreateTripCategory();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = tripCategoryFieldsSchema.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    try {
      await create.mutateAsync(parsed.data);
      setName("");
      setError(null);
    } catch (failure) {
      setError(errorText(failure));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trip types</DialogTitle>
          <DialogDescription>The defaults stay as they are; add your own.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y rounded-lg border">
          {categories.map((category) => (
            <li key={category.id} className="px-3 py-2">
              <TypeRow category={category} />
            </li>
          ))}
        </ul>
        <form noValidate onSubmit={add} className="flex flex-col gap-1.5">
          <Label htmlFor="new-trip-type">New trip type</Label>
          <div className="flex gap-2">
            <Input
              id="new-trip-type"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "new-trip-type-error" : undefined}
              placeholder="e.g. Temple visits"
              maxLength={40}
            />
            <Button type="submit" variant="outline" disabled={create.isPending}>
              Add
            </Button>
          </div>
          {error && (
            <p id="new-trip-type-error" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeRow({ category }: { category: TripCategory }) {
  const rename = useRenameTripCategory();
  const archive = useArchiveTripCategory();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const archived = !!category.archivedAt;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = tripCategoryFieldsSchema.safeParse({ name });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    try {
      await rename.mutateAsync({ id: category.id, values: parsed.data });
      setEditing(false);
      setError(null);
    } catch (failure) {
      setError(errorText(failure));
    }
  };

  if (editing) {
    return (
      <form noValidate onSubmit={save} className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`New name for ${category.name}`}
            aria-invalid={!!error}
            maxLength={40}
            autoFocus
            className="h-8"
          />
          <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save name">
            <Check />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Cancel renaming"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              setError(null);
            }}
          >
            <X />
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={
          archived ? "flex items-center gap-2 text-muted-foreground" : "flex items-center gap-2"
        }
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: typeColor(category.key) }}
          aria-hidden
        />
        {category.name}
        {archived && <Badge variant="outline">Archived</Badge>}
      </span>
      {category.key ? (
        <span className="text-xs text-muted-foreground">Default</span>
      ) : archived ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => archive.mutate({ id: category.id, archived: false })}
        >
          <ArchiveRestore data-icon="inline-start" />
          Restore
        </Button>
      ) : (
        <span className="flex gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Rename ${category.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Archive ${category.name}`}
            onClick={() => archive.mutate({ id: category.id, archived: true })}
          >
            <Archive />
          </Button>
        </span>
      )}
    </div>
  );
}
