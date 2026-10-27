/** Text under the title when a list is empty (B2). */
export function EmptyState({ children }: { children: string }) {
  return <p className="text-text-muted">{children}</p>;
}
