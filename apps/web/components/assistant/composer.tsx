"use client";

import { Send, Square } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";
import type { STRINGS } from "../../lib/i18n.ts";
import { Icon } from "../ui/icon.tsx";

interface ComposerProps {
  t: (typeof STRINGS)["en"];
  /** True while a turn is streaming — input is locked, Stop is offered. */
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

const MAX_MESSAGE = 4000; // spec §2.2: user content ≤4000 chars

/** Chat composer: Enter sends, Shift+Enter inserts a newline; the textarea
    grows with content and locks while a turn is in flight. */
export function Composer({ t, busy, onSend, onStop }: ComposerProps): ReactElement {
  const [text, setText] = useState("");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
    if (areaRef.current) areaRef.current.style.blockSize = "auto";
  };

  return (
    <form
      className="xai-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={areaRef}
        className="xai-composer-input"
        rows={1}
        dir="auto"
        value={text}
        maxLength={MAX_MESSAGE}
        placeholder={t.aiChatPlaceholder}
        aria-label={t.aiInputLabel}
        disabled={busy}
        onChange={(event) => {
          setText(event.target.value);
          event.target.style.blockSize = "auto";
          event.target.style.blockSize = `${String(Math.min(event.target.scrollHeight, 160))}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {busy ? (
        <button type="button" className="xai-composer-stop" onClick={onStop} aria-label={t.aiStop}>
          <Icon icon={Square} size={12} />
          {t.aiStop}
        </button>
      ) : (
        <button
          type="submit"
          className="xai-composer-send"
          disabled={!text.trim()}
          aria-label={t.aiSend}
        >
          <Icon icon={Send} size={14} />
        </button>
      )}
    </form>
  );
}
