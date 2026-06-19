import { useState } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { COUNTRIES, flagEmoji, countryName } from "@/lib/countries";

interface CountryPickerProps {
  value: string | null;
  onChange: (code: string) => void;
}

export default function CountryPicker({ value, onChange }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedName = countryName(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="country-picker-trigger"
        >
          <span className="flex items-center gap-2 truncate">
            {value ? (
              <>
                <span className="text-base leading-none">{flagEmoji(value)}</span>
                <span className="truncate">{selectedName}</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Select your country</span>
              </>
            )}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={c.name}
                  onSelect={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  data-testid={`country-option-${c.code}`}
                >
                  <span className="text-base leading-none mr-2">{flagEmoji(c.code)}</span>
                  <span className="flex-1">{c.name}</span>
                  <Check className={cn("w-4 h-4", value === c.code ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
