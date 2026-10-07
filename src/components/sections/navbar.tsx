"use client";

import { useState, useEffect, useRef, type MouseEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

const navLinks = [
  { href: "#about", label: "About" },
  { href: "#experience", label: "Experience" },
  { href: "#projects", label: "Projects" },
  { href: "#skills", label: "Skills" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pendingHash = useRef<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Escape closes the open menu and returns focus to its toggle. With no
  // pending hash, the close scrolls nowhere.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // The menu's exit animation measures its "auto" height, and Framer Motion
  // restores window.scrollY afterwards, cancelling any smooth scroll already
  // under way. So a menu link closes the menu first and scrolls once it has
  // finished closing.
  const handleMobileLinkClick = (event: MouseEvent<HTMLAnchorElement>, hash: string) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.button !== 0 || modified) return;
    event.preventDefault();
    pendingHash.current = hash;
    setIsOpen(false);
  };

  const scrollToPendingHash = () => {
    const hash = pendingHash.current;
    if (!hash) return;
    pendingHash.current = null;
    // Push first: the browser saves the current scroll position into the entry
    // being left, which is where Back returns to. Like a native link, a link to
    // the current hash adds no entry.
    if (location.hash !== hash) history.pushState(null, "", hash);
    document.getElementById(hash.slice(1))?.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
    });
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-background/80 backdrop-blur-md border-b" : "bg-transparent"
      )}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="text-xl font-bold tracking-tight">
          LC
        </a>

        {/* Desktop Navigation */}
        <ul className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <AnimatedThemeToggler
            variant="circle"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          />

          {/* Mobile Menu Button */}
          <button
            ref={toggleRef}
            className="md:hidden p-2"
            onClick={() => {
              // Reopening mid-close cancels the exit; drop its jump so a later
              // close doesn't scroll to it.
              pendingHash.current = null;
              setIsOpen(!isOpen);
            }}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
            aria-controls="mobile-nav"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <AnimatePresence onExitComplete={scrollToPendingHash}>
        {isOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b"
          >
            <ul className="px-6 py-4 space-y-4">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(event) => handleMobileLinkClick(event, link.href)}
                    className="block text-lg text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}