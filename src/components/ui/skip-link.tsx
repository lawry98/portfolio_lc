"use client";

/**
 * First Tab stop on every page. It shows only while focused, above both
 * pages' z-50 headers. main is focusable only for the jump (Safari won't move
 * focus to it otherwise) and drops its tabindex on blur, so clicking inside
 * main never focuses it.
 */
export function SkipLink() {
  const focusMain = () => {
    const main = document.getElementById("main");
    if (!main) return;
    main.tabIndex = -1;
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
      once: true,
    });
    main.focus();
  };

  return (
    <a
      href="#main"
      onClick={focusMain}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-60 focus:rounded-full focus:bg-foreground focus:px-6 focus:py-3 focus:font-medium focus:text-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to content
    </a>
  );
}
