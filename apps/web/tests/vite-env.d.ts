// `import.meta.glob` is provided by Vite (Vitest); only the part the tests use is declared.
interface ImportMeta {
  glob<T = unknown>(pattern: string): Record<string, () => Promise<T>>;
}
