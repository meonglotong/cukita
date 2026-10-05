// src/components/highlight-client.tsx
"use client";
import { useEffect } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github.min.css";

// Runs once per doc page: highlights code blocks, then wraps each <pre>
// in a relative container with a copy button (single pass over all pres).
export function HighlightClient() {
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".markdown-body pre code").forEach((el) => {
      hljs.highlightElement(el);
    });
    document.querySelectorAll<HTMLPreElement>(".markdown-body pre").forEach((pre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "copy";
      btn.style.cssText = "position:absolute;top:8px;right:8px;font-size:12px;padding:2px 10px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer";
      btn.onclick = () => navigator.clipboard.writeText(pre.innerText);
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:relative";
      pre.replaceWith(wrap);
      wrap.append(pre, btn);
    });
  }, []);
  return null;
}
