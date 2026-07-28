"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-2xl font-bold text-neutral-900">Sem conexão</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Você está offline. Verifique sua conexão com a internet e tente novamente.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
