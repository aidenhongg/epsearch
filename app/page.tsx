"use client";

import React, { useState, useEffect } from "react";
import { LandingPage } from "@/components/landing-page";
import { ChatHeader } from "@/components/chat-header";
import { ChatInterface } from "@/components/chat-interface";

export default function Page() {
  const [view, setView] = useState<"landing" | "chat">("landing");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a static shell on the server and first client paint to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden bg-background">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" />
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      {view === "landing" ? (
        <LandingPage onEnterChat={() => setView("chat")} />
      ) : (
        <div className="flex flex-col h-full animate-in fade-in duration-500">
          <ChatHeader onLogoClick={() => setView("landing")} />
          <ChatInterface />
        </div>
      )}
    </div>
  );
}
