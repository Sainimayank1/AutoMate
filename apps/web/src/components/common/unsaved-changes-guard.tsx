import { useEffect } from "react";
import { useBlocker } from "react-router";

import { ConfirmDialog } from "@/components/common/confirm-dialog";

type UnsavedChangesGuardProps = {
  /** Usually the form's `isDirty`. */
  when: boolean;
  title?: string;
  description?: string;
};

/**
 * Asks before leaving a form with unsaved changes: in-app navigation and closing the tab.
 * After a successful save, navigate with `{ state: { savedChanges: true } }` to pass through.
 */
export function UnsavedChangesGuard({
  when,
  title = "Discard your changes?",
  description = "You'll lose what you've entered on this page.",
}: UnsavedChangesGuardProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as { savedChanges?: boolean } | null)?.savedChanges,
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (when) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => !open && blocker.state === "blocked" && blocker.reset()}
      title={title}
      description={description}
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
