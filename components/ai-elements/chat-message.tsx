import React from "react";
import { StructuredResponse, Citation } from "./structured-response";
import { SourcesList } from "./sources-list";
import { ResponseDict } from "@/lib/ai/response-parser";
import type { Source } from "@/lib/cite/use-sources";

export interface ChatHistoryEntry {
  userText: string;
  responseDict: ResponseDict;
  citations: Record<number, Citation>;
  sources: Source[] | null;
}

interface ChatMessageProps {
  userText: string;
  responseDict: ResponseDict;
  citations: Record<number, Citation>;
  sources?: Source[] | null;
}

/** A single user-query + assistant-response pair. */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  userText,
  responseDict,
  citations,
  sources,
}) => (
  <div className="min-h-fit">
    {userText && (
      <div className="text-muted-foreground text-sm w-fit mb-1">
        {userText}
      </div>
    )}
    <StructuredResponse dict={responseDict} citations={citations} />
    {sources && <SourcesList sources={sources} />}
  </div>
);
