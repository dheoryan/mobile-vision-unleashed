import { useEffect, useState } from "react";
import { signChatAttachmentUrl } from "@/lib/uploads";

export function ChatAttachment({ value }: { value: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void signChatAttachmentUrl(value).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [value]);

  if (!url) {
    return <div className="h-36 w-52 animate-pulse rounded-lg bg-background/25" aria-hidden />;
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
      <img src={url} alt="Shared photo" className="max-h-72 w-full object-cover" loading="lazy" />
    </a>
  );
}
