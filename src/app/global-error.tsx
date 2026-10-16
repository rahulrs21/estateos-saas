"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f8fa", color: "#182c34", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <p>EstateOS</p><h1>We couldn’t load the application.</h1>
          <p>Please try again. If the problem continues, reload the page.</p>
          <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 8, border: 0, background: "#087563", color: "white", cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
