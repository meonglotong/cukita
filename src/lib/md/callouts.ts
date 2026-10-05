import { Lexer } from "marked";
import type { MarkedExtension, Tokens } from "marked";

const KINDS: Record<string, string> = { info: "callout-info", warning: "callout-warn", danger: "callout-danger" };

// Shape of the token produced by the tokenizer below; the renderer receives
// Tokens.Generic, so it casts locally. Exported so the TOC walk can re-lex
// callout bodies the same way the renderer does.
export interface CalloutToken {
  type: string;
  raw: string;
  kind: string;
  body: string;
}

export const calloutExtension: MarkedExtension = {
  extensions: [
    {
      name: "callout",
      level: "block",
      start(src: string) {
        const m = src.match(/^> \[!(info|warning|danger)\]/m);
        return m ? m.index : -1;
      },
      tokenizer(src: string) {
        const m = src.match(/^> \[!(info|warning|danger)\]\n((?:> .*\n?)+)/);
        if (!m) return;
        const body = m[2].split("\n").map((l) => l.replace(/^> ?/, "")).join("\n");
        return { type: "callout", raw: m[0], kind: KINDS[m[1]], body };
      },
      renderer(token: Tokens.Generic) {
        const { kind, body } = token as CalloutToken;
        const html = this.parser.parse(Lexer.lex(body));
        return `<div class="callout ${kind}">${html}</div>`;
      },
    },
  ],
};
