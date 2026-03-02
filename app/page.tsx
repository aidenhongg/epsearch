"use client";

import { Input } from "@/components/ui/input";
import { UIMessage, useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { LoadingIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getToolName, isToolUIPart } from "ai";
import { useResponseDict } from "@/lib/use-response-dict";
import { useSources } from "@/lib/use-sources";
import { ChatMessage, ChatHistoryEntry } from "@/components/ai-elements/chat-message";
import { buildSourceUrl } from "@/lib/source-url";
import { matchCitationsClientSide } from "@/lib/client-cite";
import type { Source } from "@/lib/use-sources";

export default function Chat() {
  const { messages, status, sendMessage, setMessages } = useChat({
    onToolCall({ toolCall }) {
      // SECURITY: Don't log tool call details — may contain user PII
      if (process.env.NODE_ENV === "development") {
        console.log("Tool call:", toolCall.toolName);
      }
    },
    onError: () => {
      toast.error("You've been rate limited, please try again later!");
    },
  });

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Preload the embedding model lazily — dynamic import keeps ONNX WASM
  // out of the initial JS bundle, avoiding a ~2MB LCP penalty.
  useEffect(() => {
    import("@/lib/local-embedding").then(({ getEmbeddingPipeline }) =>
      getEmbeddingPipeline(),
    );
  }, []);

  useEffect(() => {
    if (messages.length > 0) setIsExpanded(true);
  }, [messages]);

  const currentToolCall = useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (!lastAssistant) {
      return undefined;
    }

    const pendingPart = [...lastAssistant.parts].reverse().find((part) => {
      if (part.type === "dynamic-tool") {
        return (
          part.state !== "output-available" && part.state !== "output-error"
        );
      }

      if (!isToolUIPart(part)) {
        return false;
      }

      const toolPart = part as { state?: string };
      return (
        toolPart.state !== "output-available" &&
        toolPart.state !== "output-error"
      );
    });

    if (!pendingPart) {
      return undefined;
    }

    if (pendingPart.type === "dynamic-tool") {
      return pendingPart.toolName;
    }

    if (isToolUIPart(pendingPart)) {
      return getToolName(pendingPart);
    }

    return undefined;
  }, [messages]);

  const isAwaitingResponse =
    status === "submitted" || status === "streaming" || currentToolCall != null;

  const [showLoading, setShowLoading] = useState(isAwaitingResponse);

  useEffect(() => {
    if (isAwaitingResponse) {
      setShowLoading(true);
      return;
    }

    const timeout = setTimeout(() => setShowLoading(false), 120);
    return () => clearTimeout(timeout);
  }, [isAwaitingResponse]);

  const userQuery: UIMessage | undefined = messages
    .filter((m) => m.role === "user")
    .slice(-1)[0];

  const lastAssistantMessage: UIMessage | undefined = messages
    .filter((m) => m.role !== "user")
    .slice(-1)[0];

  // Extract raw text from the last assistant message parts
  const assistantRawText = useMemo(() => {
    if (!lastAssistantMessage) return "";
    return lastAssistantMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }, [lastAssistantMessage]);

  // Build structured dict — only assembled once streaming is complete
  const responseDict = useResponseDict(
    lastAssistantMessage?.id,
    assistantRawText,
    isAwaitingResponse,
  );

  // Sources extracted from tool result — same trash-on-reset lifecycle
  const sources = useSources(lastAssistantMessage, isAwaitingResponse);

  // Citation overlay — keyed by segment index
  type CitationType = { label: string; url: string | null };
  const [citations, setCitations] = useState<Record<number, CitationType>>({});
  const citationAbortRef = useRef<AbortController | null>(null);

  // Client-side citation matching — replaces the broken server-side
  // globalThis pipeline that can't share state across Vercel containers.
  const runCitationMatch = useCallback(
    async (
      dict: NonNullable<typeof responseDict>,
      currentSources: Source[],
      signal: AbortSignal,
    ) => {
      try {
        const result = await matchCitationsClientSide(
          currentSources,
          dict.segments,
          buildSourceUrl,
          signal,
        );
        if (!signal.aborted) {
          setCitations(result);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Client-side citation matching error:", err);
      }
    },
    [],
  );

  // Kick off client-side citation matching when both dict and sources are ready
  useEffect(() => {
    citationAbortRef.current?.abort();
    setCitations({});

    if (!responseDict?.assembled || !sources?.length) return;

    const ctrl = new AbortController();
    citationAbortRef.current = ctrl;

    runCitationMatch(responseDict, sources, ctrl.signal);

    return () => ctrl.abort();
  }, [responseDict, sources, runCitationMatch]);

  // Ref to snapshot the latest completed exchange for history preservation
  const latestEntryRef = useRef<ChatHistoryEntry | null>(null);

  // Keep the ref in sync with the current completed response
  useEffect(() => {
    if (responseDict?.assembled && userQuery) {
      const userText = userQuery.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ");
      latestEntryRef.current = { userText, responseDict, citations };
    }
  }, [responseDict, citations, userQuery]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isAwaitingResponse || input.trim() === "") return;
    {
      // Snapshot the current completed exchange into history before sending
      const snapshot = latestEntryRef.current;
      if (snapshot) {
        latestEntryRef.current = null;
        setHistory((prev) => [...prev, snapshot]);
      }
      // Clear chat history so the API receives a single-turn request,
      // ensuring the model always calls getInformation for fresh sources.
      setMessages([]);
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <div className="flex justify-center items-start sm:pt-16 min-h-screen w-full dark:bg-neutral-900 px-4 md:px-0 py-4">
      <div className="flex flex-col items-center w-full max-w-[500px]">
        <motion.div
          style={{ minHeight: 0 }}
          animate={{
            minHeight: isExpanded ? 200 : 0,
            padding: isExpanded ? 12 : 0,
          }}
          transition={{
            type: "spring",
            bounce: 0.5,
          }}
          className={cn(
            "rounded-lg w-full ",
            isExpanded
              ? "bg-neutral-200 dark:bg-neutral-800"
              : "bg-transparent",
          )}
        >
          <div className="flex flex-col w-full justify-between gap-2">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <Input
                className={`bg-neutral-100 text-base w-full text-neutral-700 dark:bg-neutral-700 dark:placeholder:text-neutral-400 dark:text-neutral-300`}
                minLength={3}
                required
                disabled={isAwaitingResponse}
                value={input}
                placeholder={"Ask me anything..."}
                onChange={(e) => setInput(e.target.value)}
              />
            </form>
            <motion.div
              transition={{
                type: "spring",
              }}
              className="min-h-fit flex flex-col gap-2"
            >
              {/* Past exchanges */}
              {history.map((entry, i) => (
                <ChatMessage
                  key={i}
                  userText={entry.userText}
                  responseDict={entry.responseDict}
                  citations={entry.citations}
                />
              ))}

              {/* Current exchange */}
              <AnimatePresence>
                {showLoading ? (
                  <div className="px-2 min-h-12">
                    <div className="dark:text-neutral-400 text-neutral-500 text-sm w-fit mb-1">
                      {userQuery?.parts
                        .filter((part) => part.type === "text")
                        .map((part) => part.text)
                        .join(" ")}
                    </div>
                    <Loading tool={currentToolCall ?? undefined} />
                  </div>
                ) : responseDict?.assembled ? (
                  <ChatMessage
                    userText={userQuery?.parts
                      .filter((part) => part.type === "text")
                      .map((part) => part.text)
                      .join(" ") ?? ""}
                    responseDict={responseDict}
                    citations={citations}
                    sources={sources}
                  />
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const Loading = ({ tool }: { tool?: string }) => {
  const toolName =
    tool === "getInformation"
      ? "Getting information"
      : tool === "addResource"
        ? "Adding information"
        : "Thinking";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring" }}
        className="overflow-hidden flex justify-start items-center"
      >
        <div className="flex flex-row gap-2 items-center">
          <div className="animate-spin dark:text-neutral-400 text-neutral-500">
            <LoadingIcon />
          </div>
          <div className="text-neutral-500 dark:text-neutral-400 text-sm">
            {toolName}...
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
