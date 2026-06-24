"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const BKO_SECTIONS = [
  { key: "identity", label: "Identity" },
  { key: "offerings", label: "Offerings" },
  { key: "audience", label: "Audience" },
  { key: "brand", label: "Brand" },
  { key: "competitive_position", label: "Competitive" },
  { key: "marketing_context", label: "Marketing" },
  { key: "social_proof", label: "Social Proof" },
  { key: "messaging", label: "Messaging" },
  { key: "compliance", label: "Compliance" },
  { key: "meta", label: "Meta" },
];

function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;
  if (typeof value === "boolean") return <Badge variant="outline">{value ? "Yes" : "No"}</Badge>;
  if (typeof value === "number") return <span className="font-mono text-indigo-400">{value}</span>;
  if (typeof value === "string") return <span>{value}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground italic">empty</span>;
    if (typeof value[0] === "string") {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <Badge key={i} variant="outline" className="text-xs">{String(v)}</Badge>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, i) => (
          <div key={i} className="rounded border border-border/30 p-2 text-xs">
            {renderValue(item, depth + 1)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className={depth > 0 ? "space-y-1" : "space-y-2"}>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="shrink-0 text-muted-foreground min-w-[140px]">
              {k.replace(/_/g, " ")}
            </span>
            <div className="flex-1">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }

  return <span>{String(value)}</span>;
}

export function BkoViewer({ bko }: { bko: Record<string, unknown> }) {
  return (
    <Accordion defaultValue={[]} className="space-y-2">
      {BKO_SECTIONS.map((section) => {
        const data = bko[section.key];
        if (!data) return null;

        return (
          <AccordionItem
            key={section.key}
            value={section.key}
            className="rounded-lg border border-border/50 bg-card/50 px-4"
          >
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              {section.label}
            </AccordionTrigger>
            <AccordionContent className="pb-4 text-sm">
              {renderValue(data)}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
