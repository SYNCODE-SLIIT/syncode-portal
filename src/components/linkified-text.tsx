import { Fragment } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/**
 * Plain text with line breaks kept and http(s) links made clickable.
 * Text is rendered by React, so nothing in it is treated as HTML.
 */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <p className={`whitespace-pre-line break-words ${className ?? ""}`}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-4 hover:text-foreground/80"
          >
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </p>
  );
}
