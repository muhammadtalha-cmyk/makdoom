'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#050505', color: '#f5efe2', fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: 40 }}>Makhdoom Fragrances</h1>
          <p style={{ color: '#a9a196' }}>We hit a problem loading the site. Please try again.</p>
          <button onClick={reset} style={{ marginTop: 24, padding: '14px 28px', borderRadius: 999, border: 0, background: '#e2bc5f', color: '#1a1306', fontWeight: 600, cursor: 'pointer' }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
