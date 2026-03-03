"use client";

import React from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";

interface LandingPageProps {
  onEnterChat: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterChat }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/landing-bg.jpg')" }}
        role="img"
        aria-label="Little Saint James aerial view"
      />

      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="animate-logo-glow"
        >
          <Logo size="lg" onClick={onEnterChat} />
        </motion.div>


      </motion.div>
    </div>
  );
};
