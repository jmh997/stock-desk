import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MemoMarkdown({ body }: { body: string }) {
  return (
    <div className="prose-memo">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
