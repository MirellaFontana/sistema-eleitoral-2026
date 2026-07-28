"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h2 className="mb-2 text-xl font-bold text-neutral-900">Erro na página</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Algo não funcionou como esperado. Tente novamente.
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
    </div>
  );
}
