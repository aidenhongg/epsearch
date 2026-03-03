"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "lg";
  className?: string;
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({ size = "sm", className, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label="EPSEARCH logo"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        backgroundImage:
          "repeating-linear-gradient(0deg, #38bdf8, #38bdf8 20px, #ffffff 20px, #ffffff 30px)",
        backgroundPositionY: hovered ? "15px" : "0px",
        transition: hovered
          ? "background-position-y 0.8s ease-in-out"
          : "background-position-y 0.15s ease-out",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.3))",
      }}
    >
      EPSEARCH.
    </span>
  );
};
