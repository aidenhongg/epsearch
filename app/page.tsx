"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LandingPage } from "@/components/landing-page";
import { ChatHeader } from "@/components/chat-header";
import { ChatInterface } from "@/components/chat-interface";

export default function Page() {
  const [view, setView] = useState<"landing" | "chat">("landing");

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {view === "landing" ? (
          <LandingPage key="landing" onEnterChat={() => setView("chat")} />
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="flex flex-col h-full"
          >
            <ChatHeader onLogoClick={() => setView("landing")} />
            <ChatInterface />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
