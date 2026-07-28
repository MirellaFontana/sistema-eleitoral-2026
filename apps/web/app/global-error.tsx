"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Algo deu errado</h1>
          <p className="mb-4 text-sm text-neutral-500">
            Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
          </p>
          {error.digest && (
            <p className="mb-4 font-mono text-xs text-neutral-400">Código: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
