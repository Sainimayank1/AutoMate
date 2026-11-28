import {
  changePasswordSchema,
  type ChangePasswordValues,
  deleteAccountSchema,
  type DeleteAccountValues,
  updateProfileSchema,
  type UpdateProfileValues,
  type UserProfile,
} from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { type Control, type FieldValues, type Resolver, useForm, useWatch } from "react-hook-form";

import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
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
import { Spinner } from "@/components/ui/spinner";
import { PasswordInput } from "@/features/auth/components/password-input";
import {
  useChangePassword,
  useDeleteAccount,
  useUpdateProfile,
} from "@/features/settings/hooks/use-settings";
import { applyServerErrors } from "@/lib/forms";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** One dialog frame for the three forms: title, description, the fields, Cancel and the action. */
function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  formId,
  submitting,
  submitLabel,
  destructive,
  children,
}: DialogProps & {
  title: string;
  description: string;
  formId: string;
  submitting: boolean;
  submitLabel: string;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={submitting}
            variant={destructive ? "destructive" : "default"}
          >
            {submitting && <Spinner data-icon="inline-start" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useSchemaForm<T extends FieldValues>(
  schema: Parameters<typeof zodResolver>[0],
  defaults: T,
) {
  const form = useForm<T>({
    resolver: zodResolver(schema) as unknown as Resolver<T>,
    defaultValues: defaults as never,
  });
  return { form, control: form.control as unknown as Control<T> };
}

export function EditProfileDialog({ user, ...props }: DialogProps & { user: UserProfile }) {
  const update = useUpdateProfile();
  const { form, control } = useSchemaForm<{ name: string; email: string; currentPassword: string }>(
    updateProfileSchema,
    { name: user.name, email: user.email, currentPassword: "" },
  );
  const email = useWatch({ control, name: "email" });
  const submit = form.handleSubmit(async (values) => {
    const changes: UpdateProfileValues = { name: values.name };
    if (values.email.trim().toLowerCase() !== user.email) {
      changes.email = values.email;
      changes.currentPassword = values.currentPassword;
    }
    try {
      await update.mutateAsync(changes);
      props.onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <FormDialog
      {...props}
      title="Edit profile"
      description="Your name, and the email you sign in with."
      formId="profile-form"
      submitting={form.formState.isSubmitting}
      submitLabel="Save"
    >
      <form
        id="profile-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <FormError message={form.formState.errors.root?.server?.message} />
        <FormField
          control={control}
          name="name"
          label="Name"
          render={(field) => <Input {...field} className="h-10" />}
        />
        <FormField
          control={control}
          name="email"
          label="Email"
          render={(field) => (
            <Input {...field} type="email" autoComplete="email" className="h-10" />
          )}
        />
        {email.trim().toLowerCase() !== user.email && (
          <FormField
            control={control}
            name="currentPassword"
            label="Current password"
            description="Needed to change the email you sign in with"
            render={(field) => <PasswordInput {...field} autoComplete="current-password" />}
          />
        )}
      </form>
    </FormDialog>
  );
}

export function ChangePasswordDialog(props: DialogProps) {
  const change = useChangePassword();
  const { form, control } = useSchemaForm<ChangePasswordValues>(changePasswordSchema, {
    currentPassword: "",
    newPassword: "",
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values);
      props.onOpenChange(false);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <FormDialog
      {...props}
      title="Change password"
      description="Your other devices are signed out; this one stays signed in."
      formId="password-form"
      submitting={form.formState.isSubmitting}
      submitLabel="Change password"
    >
      <form
        id="password-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <FormError message={form.formState.errors.root?.server?.message} />
        <FormField
          control={control}
          name="currentPassword"
          label="Current password"
          render={(field) => <PasswordInput {...field} autoComplete="current-password" />}
        />
        <FormField
          control={control}
          name="newPassword"
          label="New password"
          description="At least 8 characters, with a letter and a number"
          render={(field) => <PasswordInput {...field} autoComplete="new-password" />}
        />
      </form>
    </FormDialog>
  );
}

export function DeleteAccountDialog(props: DialogProps) {
  const remove = useDeleteAccount();
  const { form, control } = useSchemaForm<{ password: string; confirm: string }>(
    deleteAccountSchema,
    {
      password: "",
      confirm: "",
    },
  );
  const submit = form.handleSubmit(async (values) => {
    try {
      await remove.mutateAsync(values as DeleteAccountValues);
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });
  return (
    <FormDialog
      {...props}
      title="Delete your account?"
      description="Your vehicles, records, documents and their files are deleted for good. This can't be undone. Back up first if you might want them."
      formId="delete-account-form"
      submitting={form.formState.isSubmitting}
      submitLabel="Delete account"
      destructive
    >
      <form
        id="delete-account-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-4"
      >
        <FormError message={form.formState.errors.root?.server?.message} />
        <FormField
          control={control}
          name="password"
          label="Password"
          render={(field) => <PasswordInput {...field} autoComplete="current-password" />}
        />
        <FormField
          control={control}
          name="confirm"
          label="Type DELETE to confirm"
          render={(field) => <Input {...field} autoComplete="off" className="h-10" />}
        />
      </form>
    </FormDialog>
  );
}
