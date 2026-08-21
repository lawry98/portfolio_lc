/**
 * Byte demo entry point.
 *
 * This is a minimal, side-effect-free bootstrap. Tokens/theme (Task 2) and
 * layout/grain (Task 3) mount their own pieces here in later tickets.
 */
function bootstrap(): void {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) {
    return;
  }
}

bootstrap();
