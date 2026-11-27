import { type RegisterInput, registerSchema, type RegisterValues } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, ChartNoAxesCombined, Warehouse } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router";

import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { PasswordInput } from "@/features/auth/components/password-input";
import { useRegister } from "@/features/auth/hooks/use-auth";
import { applyServerErrors } from "@/lib/forms";

/** Stitch screen "Register — Desktop / Mobile", without Google sign-up and the OTP phone field. */
export function Component() {
  const register = useRegister();
  const form = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", acceptedTerms: false },
  });
  const { isSubmitting, errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values); // success: signed in, RequireGuest redirects to the dashboard
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Set up your AutoMate profile and add your first vehicle in minutes."
      eyebrow="Built for Indian car owners"
      headline="Your entire vehicle lifecycle in one precision cockpit."
      highlights={[
        { icon: Warehouse, text: "A multi-vehicle garage with RTO and spec profiles" },
        {
          icon: ChartNoAxesCombined,
          text: "True cost of ownership, with EMI kept apart from running costs",
        },
        { icon: BellRing, text: "Service, PUC and insurance reminders before they're due" },
      ]}
      footer="Defaults to ₹ (INR), km and km/L"
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={errors.root?.server?.message} />
        <FormField
          control={form.control}
          name="name"
          label="Full name"
          render={(field) => (
            <Input {...field} autoComplete="name" placeholder="Arjun Mehta" className="h-10" />
          )}
        />
        <FormField
          control={form.control}
          name="email"
          label="Email address"
          render={(field) => (
            <Input
              {...field}
              type="email"
              autoComplete="email"
              placeholder="arjun.mehta@example.in"
              className="h-10"
            />
          )}
        />
        <FormField
          control={form.control}
          name="password"
          label="Password"
          description="Use at least 8 characters with a letter and a number."
          render={(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
            />
          )}
        />
        <Controller
          control={form.control}
          name="acceptedTerms"
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="accept-terms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
              />
              <FieldContent>
                <FieldLabel htmlFor="accept-terms" className="font-normal text-muted-foreground">
                  I agree to the Terms of Service and Privacy Policy
                </FieldLabel>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="mt-1 h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Create AutoMate account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
