import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ResponseDict } from "@/lib/response-parser";

export type Citation = { label: string; url: string | null };

/**
 * Recombine segments into a single markdown string, injecting citation
 * labels at the end of each cited segment so they survive formatting.
 */
function combineSegments(
  dict: ResponseDict,
  citations?: Record<number, Citation>,
): string {
  let out = "";
  for (let i = 0; i < dict.segments.length; i++) {
    const seg = dict.segments[i];

    // Spacing between segments
    if (i > 0) {
      if (seg.precedingNewlines >= 2) out += "\n\n";
      else if (seg.precedingNewlines === 1) out += "\n";
      else out += " ";
    }

    out += seg.text;

    // Append citation marker right after the sentence text
    const cite = citations?.[i];
    if (cite) {
      // Use a placeholder that won't collide with markdown syntax
      out += `\x00CITE${i}\x00`;
    }
  }
  return out;
}

/**
 * Parses inline markdown (bold, italic, bold-italic, inline code)
 * into React elements, and resolves citation placeholders into links.
 */
function parseInlineMarkdown(
  text: string,
  citations?: Record<number, Citation>,
): React.ReactNode[] {
  // Combined regex: markdown patterns + citation placeholders
  //   1. bold-italic  ***...*** or ___...___
  //   2. bold          **...**  or __...__
  //   3. italic        *...*    or _..._
  //   4. inline code   `...`
  //   5. citation placeholder  \x00CITEn\x00
  const inlineRe =
    /(\*{3}|_{3})(.*?)\1|(\*{2}|_{2})(.*?)\3|(\*|_)(.*?)\5|(`)(.*?)\7|\x00CITE(\d+)\x00/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // bold-italic
      nodes.push(<strong key={key}><em>{match[2]}</em></strong>);
    } else if (match[3]) {
      // bold
      nodes.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[5]) {
      // italic
      nodes.push(<em key={key}>{match[6]}</em>);
    } else if (match[7]) {
      // inline code
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 text-sm"
        >
          {match[8]}
        </code>,
      );
    } else if (match[9] !== undefined) {
      // citation placeholder
      const idx = +match[9];
      const cite = citations?.[idx];
      if (cite) {
        if (cite.url) {
          nodes.push(
            <a
              key={key}
              href={cite.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent-foreground hover:underline"
            >
              {cite.label}
            </a>,
          );
        } else {
          nodes.push(<span key={key}>{cite.label}</span>);
        }
      }
    }

    key++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

interface StructuredResponseProps {
  dict: ResponseDict;
  citations?: Record<number, Citation>;
}

/**
 * Renders the model response from the assembled ResponseDict.
 * Segments are recombined into a single markdown string so that
 * bold / italic spans that cross sentence boundaries render correctly.
 * Citations are injected as placeholders and resolved during parsing.
 */
export const StructuredResponse: React.FC<StructuredResponseProps> = ({
  dict,
  citations,
}) => {
  const rendered = useMemo(() => {
    const combined = combineSegments(dict, citations);
    return parseInlineMarkdown(combined, citations);
  }, [dict, citations]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={dict.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="whitespace-pre-wrap text-base text-foreground overflow-hidden leading-relaxed"
        id="markdown"
      >
        <div className="overflow-y-auto no-scrollbar-gutter">
          {rendered}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
