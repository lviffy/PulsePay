import { Link } from "next-view-transitions";
export default function NotFound() {
  return <main id="main" className="not-found"><p className="eyebrow" data-decode>404 / NOT ON THIS CHAIN</p><h1>This route<br/>didn’t settle.</h1><p>The page you’re looking for doesn’t exist. Your next step still does.</p><div className="actions"><Link href="/" className="button">Back to PulsePay ↗</Link><Link href="/docs" className="button soft">Read the docs</Link></div></main>;
}
