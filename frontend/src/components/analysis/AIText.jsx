// Renders Gemini output with light formatting (bold segments + preserved
// line breaks) without pulling in a markdown dependency. Text is never
// injected as HTML - bold is built from React nodes, so content stays safe.

export default function AIText({ text, className = "" }) {
  const parts = String(text ?? "").split("**");
  return (
    <span className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </span>
  );
}
