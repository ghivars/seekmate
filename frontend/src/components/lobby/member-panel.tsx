"use client";

import { Crown, Flag, ShieldBan, UserMinus, UserPlus, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { MenuItem, Popover } from "@/components/ui/popover";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { useShell } from "@/components/shell/shell-context";
import { useMe } from "@/lib/auth";
import { useMembers, type Lobby, type Member } from "@/lib/data";
import { rovingKeyDown } from "@/lib/roving";
import { useIsDesktop } from "@/lib/use-media";

export interface MemberActions {
  onConnect: (member: Member) => void;
  onReport: (member: Member) => void;
  onBlock: (member: Member) => void;
  onRemove: (member: Member) => void;
}

interface Props extends MemberActions {
  lobby: Lobby;
}

export function MemberPanel(props: Props) {
  const { membersOpen } = useShell();
  const isDesktop = useIsDesktop();
  if (!membersOpen) return null;
  if (!isDesktop) return <SlideOver {...props} />;
  return (
    <aside aria-label="Anggota lobby" className="w-60 shrink-0 overflow-y-auto border-l border-line bg-side">
      <MemberList {...props} />
    </aside>
  );
}

/** Tablet and phone: modal <dialog>, so focus stays inside and Esc closes it. */
function SlideOver(props: Props) {
  const { setMembersOpen } = useShell();
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label="Anggota lobby"
      onCancel={(e) => {
        e.preventDefault();
        setMembersOpen(false);
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setMembersOpen(false);
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(82vw,300px)] animate-[drawer-right_180ms] overflow-y-auto border-l border-line bg-side p-0 shadow-2xl backdrop:animate-[fade-in_160ms]"
    >
      <div className="flex h-13 items-center justify-between border-b border-line pr-2 pl-4 font-semibold">
        Anggota
        <IconButton label="Tutup daftar anggota" onClick={() => setMembersOpen(false)}>
          <X size={18} />
        </IconButton>
      </div>
      <MemberList {...props} />
    </dialog>
  );
}

function MemberList({ lobby, ...actions }: Props) {
  const members = useMembers(lobby.id);
  if (members.isPending) {
    return (
      <div className="p-3">
        <SkeletonList rows={5} className="h-11" />
      </div>
    );
  }
  if (members.isError) return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;
  const groups = [
    { title: "Online", list: members.data.filter((m) => m.online) },
    { title: "Offline", list: members.data.filter((m) => !m.online) },
  ];
  return (
    <div className="p-2" onKeyDown={rovingKeyDown}>
      {groups.map(
        ({ title, list }) =>
          list.length > 0 && (
            <section key={title} className="mb-4">
              <h3 className="px-2 py-1.5 text-[13px] font-semibold text-muted">
                {title} ({list.length})
              </h3>
              <ul>
                {list.map((member) => (
                  <li key={member.user.id}>
                    <MemberRow member={member} lobby={lobby} {...actions} />
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}

function MemberRow({ member, lobby, ...actions }: { member: Member; lobby: Lobby } & MemberActions) {
  const me = useMe();
  const isMe = member.user.id === me.id;
  return (
    <Popover
      hover
      side="left"
      label={`Profil ${member.user.display_name}`}
      className="w-64 p-3"
      trigger={(props) => (
        <button
          data-nav
          type="button"
          {...props}
          className={`ease-ui flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-raised ${member.online ? "" : "opacity-75"}`}
        >
          <Avatar id={member.user.id} name={member.user.display_name} size="sm" online={member.online} />
          <span className="min-w-0 flex-1 truncate text-sm">{member.user.display_name}</span>
          {member.role === "owner" && (
            <span className="text-amber" title="Pembuat lobby">
              <Crown size={14} aria-hidden />
              <span className="sr-only">Pembuat lobby</span>
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <MemberCard
          member={member}
          isMe={isMe}
          canRemove={lobby.my_role === "owner" && !isMe}
          actions={actions}
          close={close}
        />
      )}
    </Popover>
  );
}

const CONNECTION_LABEL: Record<Member["connection"], string> = {
  none: "Ajukan koneksi",
  pending_out: "Menunggu jawaban",
  pending_in: "Terima koneksi",
  accepted: "Sudah terhubung",
};

function MemberCard({
  member,
  isMe,
  canRemove,
  actions,
  close,
}: {
  member: Member;
  isMe: boolean;
  canRemove: boolean;
  actions: MemberActions;
  close: () => void;
}) {
  const { user } = member;
  const run = (action: (member: Member) => void) => () => {
    close();
    action(member);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar id={user.id} name={user.display_name} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold [overflow-wrap:anywhere]">{user.display_name}</p>
          <p className="text-[13px] text-muted">
            {[user.major, user.cohort_year && `angkatan ${user.cohort_year}`].filter(Boolean).join(", ") ||
              "Profil belum diisi"}
          </p>
        </div>
      </div>
      {user.is_newcomer && <Tag tone="mint">Baru di sini</Tag>}
      {user.bio && <p className="text-sm [overflow-wrap:anywhere]">{user.bio}</p>}
      {!isMe && (
        <div className="border-t border-line pt-2">
          <MenuItem
            icon={<UserPlus size={16} />}
            onClick={run(actions.onConnect)}
            disabled={member.connection === "accepted" || member.connection === "pending_out"}
          >
            {CONNECTION_LABEL[member.connection]}
          </MenuItem>
          {canRemove && (
            <MenuItem danger icon={<UserMinus size={16} />} onClick={run(actions.onRemove)}>
              Keluarkan dari lobby
            </MenuItem>
          )}
          <MenuItem danger icon={<Flag size={16} />} onClick={run(actions.onReport)}>
            Laporkan
          </MenuItem>
          <MenuItem danger icon={<ShieldBan size={16} />} onClick={run(actions.onBlock)}>
            Blokir
          </MenuItem>
        </div>
      )}
    </div>
  );
}
