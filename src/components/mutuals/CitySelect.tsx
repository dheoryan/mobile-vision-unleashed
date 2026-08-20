import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Globe2, MapPin } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WORLD_CITIES, cityValue } from "@/lib/city-options";
import { cn } from "@/lib/utils";

const REGIONS = ["Asia", "Europe", "North America", "South America", "Africa", "Middle East", "Oceania"] as const;

export function CitySelect({ value, onChange, label = "City" }: { value: string; onChange: (value: string) => void; label?: string }) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const selected = WORLD_CITIES.find((city) => cityValue(city) === value);
  const [country, setCountry] = useState(selected?.country ?? "");
  const countries = useMemo(() => Array.from(new Set(WORLD_CITIES.map((city) => city.country))).sort(), []);
  const cities = useMemo(() => WORLD_CITIES.filter((city) => city.country === country), [country]);

  useEffect(() => {
    if (selected?.country && selected.country !== country) setCountry(selected.country);
  }, [country, selected]);

  return (
    <div>
      <p className="label-mono mb-1 text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Popover open={countryOpen} onOpenChange={setCountryOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={countryOpen}
            aria-label="Choose country"
            className={cn(
              "flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
              countryOpen && "border-primary",
            )}
          >
            <Globe2 className="h-4 w-4 shrink-0 text-primary" />
            <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
              {country || "Country"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border-border bg-popover p-0 shadow-2xl">
          <Command>
            <CommandInput placeholder="Search countries…" aria-label="Search countries" />
            <CommandList className="max-h-72 p-1">
              <CommandEmpty>No supported country found.</CommandEmpty>
              {REGIONS.map((region) => {
                const regionCountries = countries.filter((item) => WORLD_CITIES.some((city) => city.country === item && city.region === region));
                return (
                <CommandGroup key={region} heading={region}>
                  {regionCountries.map((item) => (
                      <CommandItem
                        key={item}
                        value={item}
                        onSelect={() => {
                          setCountry(item);
                          if (selected?.country !== item) onChange("");
                          setCountryOpen(false);
                          window.setTimeout(() => setCityOpen(true), 100);
                        }}
                        className="min-h-11 rounded-xl px-3"
                      >
                        <Check className={cn("h-4 w-4 text-primary", country === item ? "opacity-100" : "opacity-0")} />
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                      </CommandItem>
                  ))}
                </CommandGroup>
              )})}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover open={cityOpen} onOpenChange={setCityOpen}>
        <PopoverTrigger asChild>
          <button type="button" role="combobox" aria-expanded={cityOpen} aria-label={`Choose ${label.toLowerCase()}`} disabled={!country}
            className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-45", cityOpen && "border-primary")}
          >
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>{selected?.city || "City"}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-2xl border-border bg-popover p-0 shadow-2xl">
          <Command>
            <CommandInput placeholder={`Search cities in ${country}…`} aria-label="Search cities" />
            <CommandList className="max-h-72 p-1">
              <CommandEmpty>No supported city found.</CommandEmpty>
              <CommandGroup heading={country}>
                {cities.map((city) => {
                  const nextValue = cityValue(city);
                  return <CommandItem key={nextValue} value={city.city} onSelect={() => { onChange(nextValue); setCityOpen(false); }} className="min-h-11 rounded-xl px-3">
                    <Check className={cn("h-4 w-4 text-primary", value === nextValue ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{city.city}</span>
                  </CommandItem>;
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">Choose a standardized country, then city. Nearby uses a separate device-confirmed approximate area.</p>
    </div>
  );
}
