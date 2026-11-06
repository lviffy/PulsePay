"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main id="main" className="not-found"><p className="eyebrow">REQUEST INTERRUPTED</p><h1>Let’s try that again.</h1><p>The page could not finish loading.</p><button className="button" onClick={reset}>Retry ↗</button></main>;
}
