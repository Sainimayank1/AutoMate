import { SEARCH_KINDS, type SearchKind, type SearchResult } from "@automate/shared";
import {
  Bell,
  Car,
  FileText,
  Fuel,
  History,
  type LucideIcon,
  ReceiptIndianRupee,
  Route,
  Search,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { appModules } from "@/app/modules";
import { shortcuts } from "@/components/layout/quick-add-shortcuts";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { useSearch } from "@/features/search/hooks/use-search";
import { useActiveVehicle } from "@/hooks/use-active-vehicle";

const KIND: Record<SearchKind, { label: string; icon: LucideIcon }> = {
  vehicle: { label: "Vehicles", icon: Car },
  expense: { label: "Expenses", icon: ReceiptIndianRupee },
  fuel: { label: "Fill-ups", icon: Fuel },
  service: { label: "Service records", icon: Wrench },
  workshop: { label: "Workshops", icon: Warehouse },
  document: { label: "Documents", icon: FileText },
  trip: { label: "Trips", icon: Route },
  reminder: { label: "Reminders", icon: Bell },
};
const RECENT_KEY = "automate.recent-searches";
const RECENT_MAX = 5;

/** The last few searches on this device (a convenience: storage may be unavailable). */
function readRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function writeRecent(items: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  } catch {
    // Private mode or blocked storage: recent searches just aren't kept.
  }
}
const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent);

/**
 * App-wide search (application-navigation.md "Global search"): the header's "Search records…"
 * (a search icon on smaller screens) or Ctrl/⌘ K. Empty: recent searches, quick actions and "Go
 * to"; typing: the user's records from `GET /search`, grouped by kind, each opening its page.
 * Deviation: no Stitch screen yet; built on the shadcn command palette and the design tokens.
 */
export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const navigate = useNavigate();
  const { activeVehicle } = useActiveVehicle();
  const search = useSearch(text);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string, remember?: string) => {
    if (remember) {
      const next = [remember, ...recent.filter((item) => item !== remember)].slice(0, RECENT_MAX);
      setRecent(next);
      writeRecent(next);
    }
    setOpen(false);
    setText("");
    void navigate(href);
  };
  const typed = text.trim();
  const results = search.enabled ? (search.data?.items ?? []) : [];
  const grouped = SEARCH_KINDS.map((kind) => ({
    kind,
    items: results.filter((result: SearchResult) => result.kind === kind),
  })).filter((group) => group.items.length);
  const modules = appModules.filter((module) =>
    typed ? module.title.toLowerCase().includes(typed.toLowerCase()) : true,
  );

  return (
    <>
      <Button
        variant="outline"
        className="hidden h-8 w-56 justify-start gap-2 px-2.5 text-sm font-normal text-muted-foreground lg:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Search data-icon="inline-start" />
        Search records…
        <CommandShortcut className="ml-auto">{isMac ? "⌘K" : "Ctrl K"}</CommandShortcut>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 md:size-8 lg:hidden"
        aria-label="Search records"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setText("");
        }}
        title="Search records"
        description="Vehicles, expenses, fill-ups, service records, documents, trips and reminders"
      >
        {/* Results come from the API, already matched: the palette mustn't filter them again. */}
        <Command label="Search records" shouldFilter={false}>
          <CommandInput
            placeholder="Search records…"
            value={text}
            onValueChange={setText}
            aria-label="Search records"
          />
          <CommandList>
            {typed.length > 0 && typed.length < 2 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Keep typing: at least 2 characters.
              </p>
            )}
            {search.enabled && (search.isFetching || search.settling) && !results.length && (
              <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Spinner /> Searching…
              </p>
            )}
            {search.enabled && search.isError && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Search isn&apos;t available right now. Try again.
              </p>
            )}
            {search.enabled &&
              !search.isFetching &&
              !search.settling &&
              !search.isError &&
              !results.length &&
              !modules.length && <CommandEmpty>No records match “{typed}”.</CommandEmpty>}

            {!typed && recent.length > 0 && (
              <CommandGroup heading="Recent searches">
                {recent.map((item) => (
                  <CommandItem key={item} value={`recent ${item}`} onSelect={() => setText(item)}>
                    <History />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {grouped.map(({ kind, items }) => {
              const { label, icon: Icon } = KIND[kind];
              return (
                <CommandGroup key={kind} heading={label}>
                  {items.map((item) => (
                    <CommandItem
                      key={`${kind}-${item.id}`}
                      value={`${kind}-${item.id}`}
                      onSelect={() => go(item.href, typed)}
                    >
                      <Icon />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.title}</span>
                        {item.subtitle && (
                          <span className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {!typed && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Quick actions">
                  {shortcuts(activeVehicle?.id).map(({ label, icon: Icon, href }) => (
                    <CommandItem key={label} value={`add ${label}`} onSelect={() => go(href)}>
                      <Icon />
                      Add {label.toLowerCase()}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {modules.length > 0 && (typed.length === 0 || typed.length >= 2) && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  {modules.map((module) => (
                    <CommandItem
                      key={module.id}
                      value={`go ${module.title}`}
                      onSelect={() => go(module.path)}
                    >
                      <module.icon />
                      {module.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
