import type { ReactNode } from "react";
import { Link } from "react-router";

import { TaskPage } from "@/components/layout/task-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** A numbered section card (Stitch "Add Expense" layout). */
export function FormSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <span className="flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground tabular-nums">
            {number}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * The task page around a recurring-payment or loan form: sections on the left, a sticky summary
 * with Cancel and the save on the right (Stitch "Add Recurring Payment" / "Add Loan").
 */
export function TaskFormLayout({
  title,
  formId,
  backTo,
  saveLabel,
  saving,
  canSave,
  summary,
  onSubmit,
  children,
}: {
  title: string;
  formId: string;
  backTo: string;
  saveLabel: string;
  saving: boolean;
  canSave: boolean;
  summary: ReactNode;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <TaskPage
      title={title}
      closeOnMobile
      subtitle="Every rupee spent on your vehicles"
      backTo={backTo}
      backLabel="Back to recurring payments"
      actions={
        <Button variant="ghost" asChild className="max-sm:hidden">
          <Link to={backTo}>Cancel</Link>
        </Button>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="mx-auto grid w-full max-w-6xl gap-6 p-4 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">{summary}</CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild className="max-md:h-10">
              <Link to={backTo}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={saving || !canSave}
              className="max-md:h-10"
            >
              {saving && <Spinner data-icon="inline-start" />}
              {saveLabel}
            </Button>
          </div>
        </div>
      </form>
    </TaskPage>
  );
}
