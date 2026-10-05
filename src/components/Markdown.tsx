// src/components/Markdown.tsx
export function Markdown({ html }: { html: string }) {
  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
