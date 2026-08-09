import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "secondaryFilled"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2";

const VARIANTS: Record<ButtonVariant, string> = {
  // Filled amber with dark-brown text — the app's one loud element (PDR §9.7).
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  // Outline eucalyptus, so it never competes with the primary action.
  secondary:
    "border-2 border-secondary text-secondary-fg bg-surface hover:bg-secondary/10",
  // Filled eucalyptus — for the rare spot where "take a shift" needs the same
  // visual weight as the primary "hand one off" action, not a quieter outline.
  secondaryFilled: "bg-secondary text-secondary-fg hover:bg-secondary-hover shadow-sm",
  // Neutral: white fill, bordered only — for third-party sign-in buttons and
  // anywhere the brand colours would be wrong (e.g. next to a Google mark).
  outline: "border border-border text-text bg-surface hover:bg-bg shadow-sm",
  ghost: "text-muted hover:text-text hover:bg-border/40",
  // Urgency red is reserved for destructive intent and the דחיפות flag; it is
  // never used as an ordinary button colour.
  danger: "border-2 border-urgent text-urgent bg-surface hover:bg-urgent-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-base",
  lg: "h-14 px-8 text-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </Link>
  );
}

/** External links (wa.me) — styled identically, but a plain anchor. */
export function ExternalButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  onClick,
}: ButtonLinkProps & { onClick?: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {children}
    </a>
  );
}
