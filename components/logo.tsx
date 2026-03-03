"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "lg";
  className?: string;
  onClick?: () => void;
}

const logoStyle: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(0deg, #38bdf8, #38bdf8 15px, #ffffff 15px, #ffffff 30px)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.3))",
};

export const Logo: React.FC<LogoProps> = ({ size = "sm", className, onClick }) => {
  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label="EPSEARCH logo"
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "font-black tracking-tight select-none",
        size === "lg"
          ? "text-6xl sm:text-7xl md:text-8xl"
          : "text-2xl md:text-3xl",
        onClick && "cursor-pointer",
        className,
      )}
      style={{
        fontFamily: "Impact, 'Arial Black', sans-serif",
        ...logoStyle,
      }}
    >
      EPSEARCH.
    </span>
  );
};
