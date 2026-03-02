"use client";

import React from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";

interface LandingPageProps {
  onEnterChat: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterChat }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-lg text-white/70 tracking-wide"
          style={{ fontFamily: '"uncut sans", sans-serif' }}
        >
          Click to search
        </motion.p>
      </motion.div>
    </motion.div>
  );
};
