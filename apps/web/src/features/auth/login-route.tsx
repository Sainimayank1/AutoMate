import { type LoginInput, loginSchema, type LoginValues } from "@automate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router";

import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AuthLayout } from "@/features/auth/components/auth-layout";
import { PasswordInput } from "@/features/auth/components/password-input";
import { useLogin } from "@/features/auth/hooks/use-auth";
import { applyServerErrors } from "@/lib/forms";

/** Stitch screen "Login — Desktop / Mobile". Google and OTP sign-in are intentionally not offered. */
export function Component() {
  const login = useLogin();
  const form = useForm<LoginInput, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });
  const { isSubmitting, errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values); // success: RequireGuest redirects to the requested page
    } catch (error) {
      applyServerErrors(form.setError, error);
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to access your garage and vehicle records."
      eyebrow="Intelligent ownership"
      headline="Know your car, track every rupee, stay ahead of service."
      highlights={[
        { icon: Gauge, text: "Verified full-tank mileage and cost-per-km tracking" },
        { icon: ShieldCheck, text: "RC, insurance and PUC in one place, with expiry alerts" },
        { icon: Sparkles, text: "An AI assistant grounded in your own service history", ai: true },
      ]}
      footer="AutoMate India"
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError message={errors.root?.server?.message} />
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
          render={(field) => (
            <PasswordInput
              {...field}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          )}
        />
        <Controller
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="remember-me"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
              />
              <FieldLabel htmlFor="remember-me" className="font-normal text-muted-foreground">
                Keep me signed in on this device
              </FieldLabel>
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="mt-2 h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Sign in to AutoMate
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to AutoMate?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
