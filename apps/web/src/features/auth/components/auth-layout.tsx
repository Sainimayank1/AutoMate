import { cn } from "cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export type AuthHighlight = {
  icon: LucideIcon;
  text: string;
  /** AI features use the insight (teal) accent; everything else uses primary. */
  ai?: boolean;
};

type AuthLayoutProps = {
  /** Page heading (h1) and the browser tab title. */
  title: string;
  description: string;
  /** Brand panel (desktop only): overline, headline and three highlights. */
  eyebrow: string;
  headline: string;
  highlights: AuthHighlight[];
  footer: ReactNode;
  children: ReactNode;
};

/**
 * Split screen from the Stitch "Login" / "Register" screens: a brand panel (lg and up)
 * and the form column. Lives outside the app shell.
 */
export function AuthLayout({
  title,
  description,
  eyebrow,
  headline,
  highlights,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-12">
      <title>{`${title} · AutoMate`}</title>

      <aside className="hero-glow relative hidden flex-col justify-between border-r bg-card lg:col-span-5 lg:flex">
        <div className="p-8">
          <BrandLogo size="lg" />
        </div>
        <div className="flex max-w-md flex-col gap-6 p-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
            <p className="font-heading text-3xl font-semibold tracking-tight text-balance">
              {headline}
            </p>
          </div>
          <ul className="flex flex-col gap-3 border-t pt-4">
            {highlights.map(({ icon: Icon, text, ai }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <Icon
                  aria-hidden
                  className={cn("size-4.5 shrink-0", ai ? "text-insight" : "text-primary")}
                />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex min-h-svh flex-col gap-8 p-6 sm:p-10 lg:col-span-7">
        <div className="flex items-center">
          <BrandLogo className="lg:hidden" />
          <ThemeToggle className="ml-auto" />
        </div>

        <div className="mx-auto my-auto flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>

        <footer className="text-center text-xs text-muted-foreground/70">{footer}</footer>
      </main>
    </div>
  );
}
