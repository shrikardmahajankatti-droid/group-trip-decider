import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card space-y-3">
      <h1 className="text-lg font-semibold">Trip not found</h1>
      <p className="text-sm text-slate-600">
        Check the link in your WhatsApp group. It should look like <code>/t/your-trip-name-abc123</code>.
      </p>
      <Link className="btn-secondary" href="/">
        Create a trip instead
      </Link>
    </div>
  );
}
