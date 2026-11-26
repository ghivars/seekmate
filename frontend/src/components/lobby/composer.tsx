"use client";

import { SendHorizontal, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { IconButton } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/data";

const MAX = 1000;

interface Props {
  placeholder: string;
  editing: ChatMessage | null;
  onSend: (body: string) => void;
  onSaveEdit: (message: ChatMessage, body: string) => void;
  onCancelEdit: () => void;
  onEditLast: () => void;
  onTyping: () => void;
}

export function Composer({ placeholder, editing, onSend, onSaveEdit, onCancelEdit, onEditLast, onTyping }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [editState, setEditState] = useState<{ id: string; text: string } | null>(null);
  const text = editing ? (editState?.id === editing.id ? editState.text : editing.body) : draft;
  const trimmed = text.trim();

  const setText = (value: string) => (editing ? setEditState({ id: editing.id, text: value }) : setDraft(value));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useLayoutEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const submit = () => {
    if (!trimmed || trimmed.length > MAX) return;
    if (editing) {
      if (trimmed !== editing.body) onSaveEdit(editing, trimmed);
      onCancelEdit();
      setEditState(null);
    } else {
      onSend(trimmed);
      setDraft("");
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp" && !editing && draft === "") {
      e.preventDefault();
      onEditLast();
    } else if (e.key === "Escape" && editing) {
      e.stopPropagation();
      setEditState(null);
      onCancelEdit();
    }
  };

  return (
    <div className="shrink-0 px-3 pb-3 sm:px-4 sm:pb-5">
      {editing && (
        <div className="flex items-center justify-between rounded-t-xl border border-b-0 border-line bg-app px-3 text-sm text-muted">
          <span>Mengedit pesan</span>
          <IconButton label="Batal edit" onClick={onCancelEdit}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      <div
        className={`flex items-end gap-1 border border-line bg-raised pl-3.5 focus-within:border-link ${editing ? "rounded-b-xl" : "rounded-xl"}`}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          aria-label="Tulis pesan"
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (!editing && e.target.value) onTyping();
          }}
          onKeyDown={onKeyDown}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-6 outline-none placeholder:text-muted sm:text-[15px]"
        />
        <IconButton
          label={editing ? "Simpan" : "Kirim"}
          onClick={submit}
          disabled={!trimmed || trimmed.length > MAX}
          className="my-px text-link disabled:text-muted sm:size-10"
        >
          <SendHorizontal size={19} />
        </IconButton>
      </div>
      {text.length > MAX - 150 && (
        <p className={`mt-1 text-right text-xs ${trimmed.length > MAX ? "text-danger" : "text-muted"}`}>
          {trimmed.length}/{MAX}
        </p>
      )}
    </div>
  );
}
