"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

export function StringListField({
  label,
  values,
  onChange,
  placeholder,
  max = 8,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((val, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={val}
              onChange={(e) => {
                const updated = [...values];
                updated[i] = e.target.value;
                onChange(updated);
              }}
              placeholder={placeholder}
            />
            {values.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        {values.length < max && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([...values, ""])}
            className="text-muted-foreground"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add more
          </Button>
        )}
      </div>
    </div>
  );
}

export function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400"
          >
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        placeholder={placeholder ?? "Type and press Enter"}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const val = e.currentTarget.value.trim();
            if (val && !values.includes(val)) {
              onChange([...values, val]);
              e.currentTarget.value = "";
            }
          }
        }}
      />
    </div>
  );
}
