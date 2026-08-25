import { useEffect, useRef, useState } from "react";
import { Camera, Paperclip, Send, X } from "lucide-react";
import { ReplyPreview } from "./ReplyPreview";

export interface ChatReplyTarget {
  id: string;
  name: string;
  snippet: string;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  accentColor: string;
  replyTo?: ChatReplyTarget | null;
  onCancelReply?: () => void;
  selectedImage?: File | null;
  onSelectImage?: (file: File) => void;
  onClearImage?: () => void;
  disabled?: boolean;
  sending?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  maxLength?: number;
  accessory?: React.ReactNode;
}

/**
 * Shared mobile composer for every live chat surface. Attachment and camera
 * controls deliberately sit on the right, matching the established Tribe UI.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  accentColor,
  replyTo,
  onCancelReply,
  selectedImage,
  onSelectImage,
  onClearImage,
  disabled = false,
  sending = false,
  inputRef,
  maxLength = 2000,
  accessory,
}: ChatComposerProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  const choose = (file?: File) => {
    if (!file) return;
    onSelectImage?.(file);
  };

  const clearImage = () => {
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    onClearImage?.();
  };

  const canSend = !disabled && !sending && Boolean(value.trim() || selectedImage);

  return (
    <div className="relative shrink-0 border-t border-border/70 bg-background/90 px-3 py-2 backdrop-blur-md">
      {accessory}
      {replyTo && onCancelReply && (
        <ReplyPreview
          name={replyTo.name}
          snippet={replyTo.snippet}
          accentColor={accentColor}
          onCancel={onCancelReply}
        />
      )}
      {selectedImage && previewUrl && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-card p-2">
          <img
            src={previewUrl}
            alt="Selected attachment"
            className="h-14 w-14 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{selectedImage.name}</p>
            <p className="text-[11px] text-muted-foreground">Ready to send</p>
          </div>
          <button
            type="button"
            onClick={clearImage}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Remove selected photo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-1 rounded-[24px] border border-border bg-card py-1.5 pl-4 pr-1.5 shadow-xl shadow-black/20">
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => choose(event.target.files?.[0])}
          aria-label="Choose a photo"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => choose(event.target.files?.[0])}
          aria-label="Take a photo"
        />
        <input
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSend) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={disabled || sending}
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          disabled={disabled || sending || !onSelectImage}
          onClick={() => attachmentInputRef.current?.click()}
          aria-label="Attach a photo"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          disabled={disabled || sending || !onSelectImage}
          onClick={() => cameraInputRef.current?.click()}
          aria-label="Take a photo"
        >
          <Camera className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
          style={{ backgroundColor: accentColor }}
          aria-label={sending ? "Sending message" : "Send message"}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
