"use client";

import type { Source } from "@/lib/use-sources";
import { buildSourceUrl } from "@/lib/source-url";
import { motion } from "framer-motion";

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

export const SourcesList: React.FC<SourcesListProps> = ({ sources }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="mt-3 flex flex-col gap-1.5 text-xs font-mono text-neutral-600 dark:text-neutral-400"
  >
    <span className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-500">
      Sources ({sources.length})
    </span>
    {sources.map((s) => {
      const url = s.metadata ? buildSourceUrl(s.metadata) : null;
      const label = s.metadata ? formatSourceLabel(s.metadata) : "Unknown source";

      return (
        <div
          key={s.citationindex}
          className="rounded bg-neutral-100 px-2 py-1.5 dark:bg-neutral-700/60"
        >
          <span className="font-semibold">[{s.citationindex}]</span>{" "}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {label}
            </a>
          ) : (
            <span>{label}</span>
          )}
        </div>
      );
    })}
  </motion.div>
);
