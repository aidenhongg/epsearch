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
        backgroundImage: [
          /* 1st stripe: wide blue 25px + white 15px = 40px */
          "linear-gradient(0deg,",
          "#38bdf8 0px, #38bdf8 25px,",
          "#ffffff 25px, #ffffff 40px,",
          /* remaining stripes: normal 15px blue + 15px white */
          "#38bdf8 40px, #38bdf8 55px,",
          "#ffffff 55px, #ffffff 70px,",
          "#38bdf8 70px, #38bdf8 85px,",
          "#ffffff 85px, #ffffff 100px,",
          "#38bdf8 100px, #38bdf8 115px,",
          "#ffffff 115px, #ffffff 130px,",
          "#38bdf8 130px, #38bdf8 145px,",
          "#ffffff 145px, #ffffff 160px,",
          "#38bdf8 160px, #38bdf8 175px,",
          "#ffffff 175px, #ffffff 190px,",
          "#38bdf8 190px)",
        ].join(" "),
        backgroundPositionY: hovered ? "15px" : "6px",
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
