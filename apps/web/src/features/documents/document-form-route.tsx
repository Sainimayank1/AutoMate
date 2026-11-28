import {
  createDocumentSchema,
  type CreateDocumentValues,
  DEFAULT_REMINDER_DAYS,
  DOCUMENT_FILE_TYPES,
  type DocumentFile,
  DocumentType,
  MAX_DOCUMENT_FILE_BYTES,
  MAX_DOCUMENT_FILES,
  type Vehicle,
  type VehicleDocument,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Camera, CloudUpload, FileText, Trash2 } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { type Control, type Resolver, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { z } from "zod";

import { DatePicker } from "@/components/common/date-picker";
import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TaskPage } from "@/components/layout/task-page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPES } from "@/features/documents/constants";
import {
  useCreateDocument,
  useDocument,
  useUpdateDocument,
  useUploadFile,
} from "@/features/documents/hooks/use-documents";
import { vehicleName } from "@/features/garage/constants";
import { usePreferences } from "@/features/settings/hooks/use-settings";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";
import { normalizeApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";
import { formatFileSize, formatRegistration } from "@/utils/format";

type DocumentForm = {
  vehicleId: string;
  type: DocumentType;
  name: string;
  number: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
  reminders: boolean;
  remindOn: string;
};
type Values = Omit<CreateDocumentValues, "fileIds">;
/** The checkbox stands for the user's default reminders (Settings; 30, 7 and 1 days before) or none. */
const formSchemaFor = (days: readonly number[]) =>
  z.preprocess((value) => {
    const { reminders, ...rest } = value as DocumentForm;
    return { ...rest, reminderDays: reminders ? [...days] : [] };
  }, createDocumentSchema) as unknown as z.ZodType<Values, DocumentForm>;

type Upload = { key: string; name: string; size: number; file?: DocumentFile; error?: string };
const ACCEPT = DOCUMENT_FILE_TYPES.join(",");

const toForm = (
  vehicleId: string,
  document: VehicleDocument | undefined,
  renew: boolean,
  type?: DocumentType,
): DocumentForm => ({
  vehicleId: document?.vehicleId ?? vehicleId,
  type: document?.type ?? type ?? DocumentType.PUC,
  name: document?.name ?? "",
  number: renew ? "" : (document?.number ?? ""),
  issuer: document?.issuer ?? "",
  // A renewal is a new certificate: new dates, new copy.
  issueDate: renew ? "" : (document?.issueDate ?? ""),
  expiryDate: renew ? "" : (document?.expiryDate ?? ""),
  notes: document?.notes ?? "",
  reminders: document ? document.reminderDays.length > 0 : true,
  remindOn: renew ? "" : (document?.remindOn ?? ""),
});

/**
 * `/documents/new` and `/documents/:documentId/edit` (Stitch "Add Document"): the details, the
 * files (dropped, chosen, or a phone camera's scan), each sent straight to storage, and the
 * reminders. `?renew=1` starts a renewal (new dates and copy); `?type=` preselects a type.
 */
export function Component() {
  const { documentId } = useParams();
  const [params] = useSearchParams();
  const garage = useActiveVehicle();
  const document = useDocument(documentId);
  if (garage.isPending || (documentId && document.isPending)) {
    return <LoadingState fullScreen label="Loading…" />;
  }
  if (garage.isError || document.isError) {
    return (
      <ErrorState
        className="min-h-svh"
        title="Couldn't load the form"
        error={garage.error ?? document.error}
        onRetry={() => void Promise.all([garage.refetch(), document.refetch()])}
      />
    );
  }
  const renew = params.get("renew") === "1";
  const type = (Object.values(DocumentType) as string[]).includes(params.get("type") ?? "")
    ? (params.get("type") as DocumentType)
    : undefined;
  return (
    <DocumentFormPage
      vehicles={garage.vehicles}
      document={document.data}
      renew={renew}
      defaults={toForm(garage.activeVehicle?.id ?? "", document.data, renew, type)}
    />
  );
}

function DocumentFormPage({
  vehicles,
  document,
  renew,
  defaults,
}: {
  vehicles: Vehicle[];
  document?: VehicleDocument;
  renew: boolean;
  defaults: DocumentForm;
}) {
  const navigate = useNavigate();
  const fileInput = useId();
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const create = useCreateDocument();
  const update = useUpdateDocument(document?.id ?? "");
  const uploader = useUploadFile();
  const [uploads, setUploads] = useState<Upload[]>(
    renew
      ? []
      : (document?.files ?? []).map((file) => ({
          key: file.id,
          name: file.fileName,
          size: file.size,
          file,
        })),
  );
  const [dragging, setDragging] = useState(false);
  const reminderDays = usePreferences().data?.reminderTiming.documentDays ?? DEFAULT_REMINDER_DAYS;
  const formSchema = useMemo(() => formSchemaFor(reminderDays), [reminderDays]);
  const form = useForm<DocumentForm, unknown, Values>({
    resolver: zodResolver(formSchema) as unknown as Resolver<DocumentForm, unknown, Values>,
    defaultValues: defaults,
    mode: "onTouched",
  });
  const control = form.control as unknown as Control<DocumentForm>;
  const { isDirty, isSubmitting, errors } = form.formState;
  const type = useWatch({ control, name: "type" });
  const pending = uploads.some((upload) => !upload.file && !upload.error);
  const filesChanged =
    uploads.map((upload) => upload.file?.id).join() !==
    (document?.files ?? []).map((file) => file.id).join();
  const backTo = document ? `/documents/${document.id}` : "/documents";

  const add = (files: FileList | null) => {
    const room = MAX_DOCUMENT_FILES - uploads.filter((upload) => !upload.error).length;
    for (const file of [...(files ?? [])].slice(0, Math.max(room, 0))) {
      const key = crypto.randomUUID();
      const problem = !(DOCUMENT_FILE_TYPES as readonly string[]).includes(file.type)
        ? "Use a PDF, JPEG, PNG, WebP or HEIC file."
        : file.size > MAX_DOCUMENT_FILE_BYTES
          ? "Use a file of 10 MB or less."
          : undefined;
      setUploads((current) => [
        ...current,
        { key, name: file.name, size: file.size, error: problem },
      ]);
      if (problem) continue;
      uploader.mutate(file, {
        onSuccess: (saved) =>
          setUploads((current) =>
            current.map((item) => (item.key === key ? { ...item, file: saved } : item)),
          ),
        onError: (error) =>
          setUploads((current) =>
            current.map((item) =>
              item.key === key ? { ...item, error: normalizeApiError(error).message } : item,
            ),
          ),
      });
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const fileIds = uploads.flatMap((upload) => (upload.file ? [upload.file.id] : []));
    try {
      const saved = document
        ? await update.mutateAsync({ ...values, fileIds })
        : await create.mutateAsync({ ...values, fileIds });
      navigate(`/documents/${saved.id}`, { replace: true, state: { savedChanges: true } });
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <TaskPage
      title={renew ? "Renew document" : document ? "Edit document" : "Add document"}
      subtitle="RC, insurance, PUC, licence, warranty or an invoice"
      backTo={backTo}
      backLabel={document ? "Back to the document" : "Back to Documents"}
      actions={
        <Button variant="ghost" onClick={() => navigate(backTo)} className="max-md:hidden">
          Cancel
        </Button>
      }
    >
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8"
      >
        <div className="flex flex-col gap-5 rounded-xl border bg-card p-4 md:p-6">
          <FormError message={errors.root?.server?.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="name"
              label="Document name"
              render={(field) => (
                <Input {...field} placeholder="PUC certificate" className="h-10" />
              )}
            />
            <FormField
              control={control}
              name="type"
              label="Document type"
              render={(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(DocumentType).map((value) => (
                      <SelectItem key={value} value={value}>
                        {DOCUMENT_TYPES[value].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={control}
              name="vehicleId"
              label="Vehicle"
              optional={type === DocumentType.DRIVING_LICENCE}
              render={(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    className="w-full data-[size=default]:h-10"
                  >
                    <SelectValue placeholder="Choose a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicleName(vehicle)} ({formatRegistration(vehicle.registrationNumber)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={control}
              name="number"
              label={DOCUMENT_TYPES[type].number}
              optional
              render={(field) => (
                <Input {...field} placeholder="HR026-PUC-9921" className="h-10 font-mono" />
              )}
            />
            <FormField
              control={control}
              name="issueDate"
              label="Issue date"
              optional
              render={(field) => (
                <DatePicker
                  ref={field.ref}
                  id={field.id}
                  aria-invalid={field["aria-invalid"]}
                  value={field.value ? parseISO(field.value) : undefined}
                  onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                />
              )}
            />
            <FormField
              control={control}
              name="expiryDate"
              label="Expiry date"
              optional
              render={(field) => (
                <DatePicker
                  ref={field.ref}
                  id={field.id}
                  aria-invalid={field["aria-invalid"]}
                  value={field.value ? parseISO(field.value) : undefined}
                  onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                />
              )}
            />
            <FormField
              control={control}
              name="issuer"
              label="Issued by"
              optional
              render={(field) => (
                <Input {...field} placeholder="Shree Balaji PUC Centre" className="h-10" />
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={fileInput}>Files</Label>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                add(event.dataTransfer.files);
              }}
              data-dragging={dragging}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-elevated p-6 text-center data-[dragging=true]:border-primary"
            >
              <CloudUpload className="size-7 text-primary" aria-hidden />
              <p className="text-sm font-medium">Drop a PDF or photo here</p>
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, WebP or HEIC, up to 10 MB each, {MAX_DOCUMENT_FILES} files at most.
                Kept in private storage.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="max-md:h-10"
                  onClick={() => pickRef.current?.click()}
                >
                  Choose files
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="max-md:h-10"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera data-icon="inline-start" />
                  Scan with camera
                </Button>
              </div>
              <input
                ref={pickRef}
                id={fileInput}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(event) => {
                  add(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Scan with camera"
                className="sr-only"
                onChange={(event) => {
                  add(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
            {uploads.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border" aria-label="Attached files">
                {uploads.map((upload) => (
                  <li key={upload.key} className="flex items-center gap-3 px-3 py-2">
                    {upload.file || upload.error ? (
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <Spinner className="size-4" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{upload.name}</p>
                      <p
                        className={
                          upload.error
                            ? "text-xs text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {upload.error ?? (upload.file ? formatFileSize(upload.size) : "Uploading…")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="max-md:size-10"
                      aria-label={`Remove ${upload.name}`}
                      onClick={() =>
                        setUploads((current) => current.filter((item) => item.key !== upload.key))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <FormField
              control={control}
              name="reminders"
              label="Reminders"
              render={(field) => (
                <Label className="flex items-center gap-2.5 font-normal">
                  <Checkbox
                    id={field.id}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  Remind me 30, 7 and 1 days before it expires
                </Label>
              )}
            />
            <div className="sm:w-1/2">
              <FormField
                control={control}
                name="remindOn"
                label="Also remind me on"
                optional
                render={(field) => (
                  <DatePicker
                    ref={field.ref}
                    id={field.id}
                    aria-invalid={field["aria-invalid"]}
                    value={field.value ? parseISO(field.value) : undefined}
                    onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                  />
                )}
              />
            </div>
          </div>
          <FormField
            control={control}
            name="notes"
            label="Notes"
            optional
            render={(field) => (
              <Textarea {...field} rows={3} placeholder="Renew at the same centre" />
            )}
          />

          <footer className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || pending}>
              {(isSubmitting || pending) && <Spinner data-icon="inline-start" />}
              {pending ? "Uploading…" : document && !renew ? "Save changes" : "Save to vault"}
            </Button>
          </footer>
        </div>
      </form>
      <UnsavedChangesGuard when={(isDirty || filesChanged) && !form.formState.isSubmitSuccessful} />
    </TaskPage>
  );
}
