import { Fragment } from "react";

// Renders tweet text with @mentions and #hashtags highlighted in the accent
// color (display-only in 2B — not links yet). The token regex allows Bengali
// codepoints (ঀ-৿) so handles/hashtags in Bangla also light up.
const TAG = /^[@#][\wঀ-৿]+$/;

export function RichText({ text }: { text: string }) {
  // Split on whitespace but keep the separators so spacing/newlines survive.
  const tokens = text.split(/(\s+)/);
  return (
    <>
      {tokens.map((tok, i) =>
        TAG.test(tok) ? (
          <span className="tag" key={i}>
            {tok}
          </span>
        ) : (
          <Fragment key={i}>{tok}</Fragment>
        )
      )}
    </>
  );
}
