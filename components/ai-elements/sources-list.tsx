"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Source } from "@/lib/cite/use-sources";
import { buildSourceUrl } from "@/lib/cite/source-url";
import { motion, AnimatePresence } from "framer-motion";

interface SourcesListProps {
  sources: Source[];
}

/** Format display label from metadata: "FILENAME.pdf, page N." */
function formatSourceLabel(meta: Record<string, unknown>): string {
  const filename = meta.filename as string | undefined;
  const pagenum = meta.pagenum as number | undefined;
  if (!filename) return "Unknown source";
  return pagenum != null ? `${filename}.pdf, page ${pagenum}.` : `${filename}.pdf`;
}

export const SourcesList: React.FC<SourcesListProps> = ({ sources }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 text-xs text-muted-foreground"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded bg-muted px-2 py-1.5 transition-colors hover:bg-muted/80"
      >
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Sources ({sources.length})
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="sources-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 pt-1.5">
              {sources.map((s) => {
                const url = s.metadata ? buildSourceUrl(s.metadata) : null;
                const label = s.metadata
                  ? formatSourceLabel(s.metadata)
                  : "Unknown source";

                return (
                  <div
                    key={s.citationindex}
                    className="rounded bg-muted px-2 py-1.5"
                  >
                    <span className="font-semibold">[{s.citationindex}]</span>{" "}
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-accent-foreground hover:text-foreground"
                      >
                        {label}
                      </a>
                    ) : (
                      <span>{label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
