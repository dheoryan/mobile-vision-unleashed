import { useEffect, useRef, useState } from "react";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { PaperclipIcon } from "@phosphor-icons/react/dist/csr/Paperclip";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { ReplyPreview } from "./ReplyPreview";
import { cn } from "@/lib/utils";

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
  onCaretChange?: (caret: number) => void;
  outerClassName?: string;
  keyboardOpen?: boolean;
  gradientAction?: boolean;
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
  onCaretChange,
  outerClassName,
  keyboardOpen = false,
  gradientAction = false,
}: ChatComposerProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previousReplyId = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const nextReplyId = replyTo?.id ?? null;
    if (nextReplyId && nextReplyId !== previousReplyId.current) {
      inputRef?.current?.focus({ preventScroll: true });
    }
    previousReplyId.current = nextReplyId;
  }, [inputRef, replyTo?.id]);

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
    <div
      className={`relative min-w-0 shrink-0 border-t border-border/70 bg-background/90 px-3 pt-2 backdrop-blur-md ${
        keyboardOpen ? "pb-2" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      } ${outerClassName ?? ""}`}
    >
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
        <div className="mb-2 flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-2">
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
            <XIcon className="h-4 w-4" />
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
        {/* autoComplete="off" alone does not suppress Chrome/Android's
            password-manager "manual fallback" icon above the keyboard - it's
            a deliberate Chrome design choice, not something the off value
            was meant to block, and it holds regardless. type="search" is
            what actually works: Chrome's Autofill agent treats search
            inputs as non-fillable and excludes them from all three
            (password/payment/address) icon rows entirely. The three
            ::-webkit-search-* rules below strip the native rounded/inset
            search-field chrome so it still looks identical to a plain text
            field; enterKeyHint keeps the mobile keyboard's action key
            labeled Send instead of Search. */}
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="send"
          role="textbox"
          value={value}
          maxLength={maxLength}
          name="chat-message"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          data-lpignore="true"
          data-1p-ignore
          onChange={(event) => {
            onChange(event.target.value);
            onCaretChange?.(event.target.selectionStart ?? event.target.value.length);
          }}
          onClick={(event) =>
            onCaretChange?.(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
          }
          onKeyUp={(event) =>
            onCaretChange?.(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSend) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={disabled || sending}
          className="min-w-0 flex-1 appearance-none bg-transparent text-base placeholder:text-muted-foreground focus:outline-none disabled:opacity-60 sm:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
        />
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          disabled={disabled || sending || !onSelectImage}
          onClick={() => attachmentInputRef.current?.click()}
          aria-label="Attach a photo"
        >
          <PaperclipIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
          disabled={disabled || sending || !onSelectImage}
          onClick={() => cameraInputRef.current?.click()}
          aria-label="Take a photo"
        >
          <CameraIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,filter] active:scale-95 disabled:opacity-40",
            gradientAction
              ? "bg-meutuals-gradient text-white hover:brightness-110"
              : "text-primary-foreground",
          )}
          style={gradientAction ? undefined : { backgroundColor: accentColor }}
          aria-label={sending ? "Sending message" : "Send message"}
        >
          <PaperPlaneTiltIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
