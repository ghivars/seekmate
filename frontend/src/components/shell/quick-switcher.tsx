"use client";

import { BookOpen, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type KeyboardEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { useMyCourses, useSwitcherLobbies } from "@/lib/data";

interface Entry {
  id: string;
  href: string;
  label: string;
  hint: string;
  kind: "course" | "lobby";
}

export function QuickSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Cari cepat" hideTitle>
      <Switcher onClose={onClose} />
    </Modal>
  );
}

function Switcher({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const courses = useMyCourses();
  const lobbies = useSwitcherLobbies();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listId = useId();

  const entries: Entry[] = [
    ...(courses.data ?? []).map((c): Entry => ({ id: c.id, href: `/c/${c.id}`, label: c.name, hint: c.code, kind: "course" })),
    ...lobbies.map((l): Entry => ({ id: l.id, href: `/c/${l.course_id}/${l.id}`, label: l.title, hint: l.course_code, kind: "lobby" })),
  ];
  const term = query.trim().toLowerCase();
  const results = entries.filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(term)).slice(0, 12);
  const active = Math.min(index, results.length - 1);

  const pick = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setIndex(Math.min(active + 1, results.length - 1));
    else if (e.key === "ArrowUp") setIndex(Math.max(active - 1, 0));
    else if (e.key === "Enter") pick(results[active]);
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex flex-col">
      <input
        data-autofocus
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        aria-label="Cari mata kuliah atau lobby"
        placeholder="Cari mata kuliah atau lobby"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={onKeyDown}
        className="h-14 border-b border-line bg-transparent px-5 text-[16px] outline-none placeholder:text-muted"
      />
      <ul id={listId} role="listbox" aria-label="Hasil" className="max-h-[50dvh] overflow-y-auto p-2">
        {results.map((entry, i) => (
          <li
            key={entry.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onPointerMove={() => setIndex(i)}
            onClick={() => pick(entry)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3",
              i === active ? "bg-raised" : "text-muted",
            )}
          >
            {entry.kind === "course" ? <BookOpen size={16} aria-hidden /> : <Hash size={16} aria-hidden />}
            <span className="min-w-0 flex-1 truncate text-fg">{entry.label}</span>
            <span className="text-xs text-muted">{entry.hint}</span>
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Tidak ketemu. Coba kata lain.</li>}
      </ul>
    </div>
  );
}
