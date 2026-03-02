import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ResponseDict, SentenceSegment } from "@/lib/response-parser";

/**
 * Parses inline markdown (bold, italic, bold-italic, inline code)
 * into React elements. Handles nesting order: bold-italic first,
 * then bold, italic, and inline code.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex alternation for inline patterns (order matters):
  //   1. bold-italic  ***...*** or ___...___
  //   2. bold          **...**  or __...__
  //   3. italic        *...*    or _..._
  //   4. inline code   `...`
  const inlineRe =
    /(\*{3}|_{3})(.*?)\1|(\*{2}|_{2})(.*?)\3|(\*|_)(.*?)\5|(`)(.*?)\7/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // bold-italic
      nodes.push(<strong key={match.index}><em>{match[2]}</em></strong>);
    } else if (match[3]) {
      // bold
      nodes.push(<strong key={match.index}>{match[4]}</strong>);
    } else if (match[5]) {
      // italic
      nodes.push(<em key={match.index}>{match[6]}</em>);
    } else if (match[7]) {
      // inline code
      nodes.push(
        <code
          key={match.index}
          className="rounded bg-neutral-300 px-1 py-0.5 dark:bg-neutral-700"
        >
          {match[8]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Renders a single sentence segment, reconstructing the correct
 * vertical spacing via preceding newlines.
 */
export type Citation = { label: string; url: string | null };

const SegmentRenderer = ({
  segment,
  index,
  citation,
}: {
  segment: SentenceSegment;
  index: number;
  citation?: Citation;
}) => {
  // Convert newline counts into spacing:
  // 0 newlines = inline continuation (space between sentences)
  // 1 newline  = soft break
  // 2+ newlines = paragraph break
  const spacer =
    segment.precedingNewlines >= 2
      ? "\n\n"
      : segment.precedingNewlines === 1
        ? "\n"
        : index > 0
          ? " "
          : "";

  const rendered = useMemo(() => parseInlineMarkdown(segment.text), [segment.text]);

  return (
    <React.Fragment key={index}>
      {spacer}
      {rendered}
      {citation && (
        citation.url ? (
          <a
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {citation.label}
          </a>
        ) : (
          <span>{citation.label}</span>
        )
      )}
    </React.Fragment>
  );
};

interface StructuredResponseProps {
  dict: ResponseDict;
  citations?: Record<number, Citation>;
}

/**
 * Renders the model response exclusively from the assembled ResponseDict.
 * This component should only be mounted when `dict.assembled === true`.
 */
export const StructuredResponse: React.FC<StructuredResponseProps> = ({
  dict,
  citations,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={dict.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="whitespace-pre-wrap font-mono anti text-sm text-neutral-800 dark:text-neutral-200 overflow-hidden"
        id="markdown"
      >
        <div className="max-h-72 overflow-y-scroll no-scrollbar-gutter">
          {dict.segments.map((segment, i) => (
            <SegmentRenderer key={i} segment={segment} index={i} citation={citations?.[i]} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
