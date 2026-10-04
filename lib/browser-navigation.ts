/** Native full-document navigation, kept separate from router navigation. */
export function navigateDocument(destination: string): void {
  window.location.href = destination;
}

export function reloadDocument(): void {
  window.location.reload();
}
