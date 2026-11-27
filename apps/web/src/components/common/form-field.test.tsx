import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { FormError } from "@/components/common/form-error";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/forms";

const schema = z.object({ name: z.string().min(1, "Name is required") });
type Values = z.infer<typeof schema>;

/** The reference form pattern: zod schema → useForm → FormField → applyServerErrors on failure. */
function ExampleForm({ onSubmit }: { onSubmit: (values: Values) => Promise<void> }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });

  return (
    <form
      onSubmit={form.handleSubmit((values) =>
        onSubmit(values).catch((error: unknown) => applyServerErrors(form.setError, error)),
      )}
    >
      <FormError message={form.formState.errors.root?.server?.message} />
      <FormField
        control={form.control}
        name="name"
        label="Vehicle name"
        render={(field) => <Input {...field} />}
      />
      <Button type="submit">Save</Button>
    </form>
  );
}

describe("form pattern", () => {
  it("shows client validation errors on the field", async () => {
    render(<ExampleForm onSubmit={async () => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Vehicle name")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows server errors on the field and on the form", async () => {
    const serverError = new ApiError("Please fix the highlighted fields.", {
      status: 400,
      code: "VALIDATION_ERROR",
      fieldErrors: { name: "Name already used" },
    });
    render(<ExampleForm onSubmit={() => Promise.reject(serverError)} />);

    await userEvent.type(screen.getByLabelText("Vehicle name"), "City car");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name already used")).toBeInTheDocument();
    expect(screen.getByText("Please fix the highlighted fields.")).toBeInTheDocument();
  });
});
