import { CopyButton } from "./CopyButton";

export function WhatsAppShare({ message }: { message: string }) {
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Tell the group</h2>
      <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm">{message}</pre>
      <div className="flex flex-col gap-2 sm:flex-row">
        <CopyButton text={message} label="Copy WhatsApp message" />
        <a
          className="btn-primary"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
