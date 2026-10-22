'use client';
export default function ErrorPage({ reset }) {
  return (
    <main className="standalone">
      <h1>Não foi possível abrir esta página.</h1>
      <p>Seus dados permanecem no banco. Tente novamente.</p>
      <button onClick={reset} className="button">
        Tentar novamente
      </button>
    </main>
  );
}
