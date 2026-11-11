export function isUserEvent(event: Event): boolean {
  return event.isTrusted;
}
