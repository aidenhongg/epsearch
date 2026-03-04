"use client";

import React, { useState } from "react";
import { Logo } from "@/components/logo";
import { Info, X } from "lucide-react";

interface ChatHeaderProps {
  onLogoClick: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onLogoClick }) => {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <header className="relative flex items-center justify-between px-4 md:px-6 py-3 bg-card border-b border-border">
      <Logo size="sm" onClick={onLogoClick} />

      <button
        onClick={() => setAboutOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5"
        aria-label="About us"
        aria-expanded={aboutOpen}
      >
        <Info size={18} />
        <span className="text-sm hidden sm:inline">About</span>
      </button>

      {/* About dropdown */}
      {aboutOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAboutOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-4 md:right-6 top-full mt-2 z-50 w-96 rounded-lg border border-border bg-card shadow-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground text-lg">
                About EPSEARCH
              </h3>
              <button
                onClick={() => setAboutOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close about panel"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              EPSEARCH is a search tool powered by Venice AI to help 
              search through the Epstein documents, released January 30, 2026.
              <br /><br />
              Make sure to review sources manually.
              <br /><br /> 
              Made by  <a href="https://www.linkedin.com/in/aiden-hong-3a19a4315/" target="_blank" rel="noopener noreferrer" className="underline text-sky-400 hover:text-sky-300 transition-colors">Aiden</a> for a good cause.<br />
            </p>
          </div>
        </>
      )}
    </header>
  );
};
