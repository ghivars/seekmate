"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ReportSheet, type ReportTarget } from "@/components/report-sheet";
import { ConfirmModal } from "@/components/ui/confirm";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { useLobbyChat } from "@/lib/chat";
import { useBlockActions, useConnectionActions, useLobbyAction, type ChatMessage, type Lobby, type Member } from "@/lib/data";
import { ClosedBanner, ExpiredBanner, ReconnectBanner, RetentionBanner } from "./banners";
import { Composer } from "./composer";
import { JoinBar } from "./join-bar";
import { JoinSheet } from "./join-sheet";
import { LobbyHeader } from "./lobby-header";
import { LobbyIntro } from "./lobby-intro";
import { MemberPanel } from "./member-panel";
import { MessageList } from "./message-list";
import { EMAIL_NOTICE, SaveConnectionsModal } from "./save-connections-modal";

type Dialog =
  | { kind: "leave" | "close" | "save" | "join" }
  | { kind: "delete"; message: ChatMessage }
  | { kind: "connect" | "block" | "remove"; member: Member };

export function LobbyView({ lobby }: { lobby: Lobby }) {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const chat = useLobbyChat(lobby, me);
  const actions = useLobbyAction(lobby.id);
  const { block } = useBlockActions();
  const { request } = useConnectionActions();
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const active = lobby.status === "open" || lobby.status === "full";
  const canWrite = lobby.is_member && active;
  const { markRead } = chat;
  const onReachBottom = useCallback(() => markRead(), [markRead]);
  const close = () => setDialog(null);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${lobby.course_id}/${lobby.id}`);
      toast("Tautan lobby disalin.");
    } catch {
      toast("Belum bisa menyalin tautan di browser ini.");
    }
  };

  const editLast = () => {
    const last = chat.messages.findLast((m) => m.sender.id === me.id && !m.deleted && !m.state);
    if (last) setEditing(last);
  };

  const saveEdit = (message: ChatMessage, body: string) => {
    chat.edit(message, body).catch((e: unknown) => toast(errorMessage(e)));
  };

  return (
    <>
      <LobbyHeader
        lobby={lobby}
        onShare={() => void share()}
        onReport={() => setReport({ type: "lobby", id: lobby.id, label: "lobby ini" })}
        onLeave={() => setDialog({ kind: "leave" })}
        onClose={() => setDialog({ kind: "close" })}
      />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {lobby.status === "expired" ? (
            <ExpiredBanner onSave={() => setDialog({ kind: "save" })} />
          ) : lobby.status === "closed" ? (
            <ClosedBanner />
          ) : (
            lobby.is_member && <RetentionBanner />
          )}
          {canWrite && chat.connection === "offline" && <ReconnectBanner />}
          {chat.isPending ? (
            <div className="flex-1 p-4">
              <SkeletonList rows={7} className="h-12" />
            </div>
          ) : chat.error ? (
            <div className="flex-1">
              <ErrorState error={chat.error} onRetry={chat.refetch} />
            </div>
          ) : (
            <MessageList
              messages={chat.messages}
              meId={me.id}
              lastReadAt={chat.lastReadAt}
              header={<LobbyIntro lobby={lobby} onShare={() => void share()} />}
              hasMore={chat.hasMore}
              loadingMore={chat.loadingMore}
              onLoadMore={chat.loadMore}
              canAct={lobby.is_member}
              canEdit={canWrite}
              onReport={(m) => setReport({ type: "message", id: m.id, label: "pesan ini" })}
              onDelete={(message) => setDialog({ kind: "delete", message })}
              onEdit={setEditing}
              onRetry={chat.retry}
              onReachBottom={onReachBottom}
            />
          )}
          {canWrite ? (
            <>
              <p className="h-5 truncate px-4 text-xs text-muted" aria-hidden>
                {chat.typing.length > 0 && `${chat.typing.join(", ")} sedang mengetik...`}
              </p>
              <Composer
                placeholder="Tulis pesan"
                editing={editing}
                onSend={chat.send}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditing(null)}
                onEditLast={editLast}
                onTyping={chat.notifyTyping}
              />
            </>
          ) : (
            !lobby.is_member && <JoinBar lobby={lobby} onJoin={() => setDialog({ kind: "join" })} />
          )}
        </main>
        <MemberPanel
          lobby={lobby}
          onConnect={(member) => setDialog({ kind: "connect", member })}
          onReport={(m) => setReport({ type: "user", id: m.user.id, label: m.user.display_name })}
          onBlock={(member) => setDialog({ kind: "block", member })}
          onRemove={(member) => setDialog({ kind: "remove", member })}
        />
      </div>

      <JoinSheet lobby={dialog?.kind === "join" ? lobby : null} onClose={close} />
      <ReportSheet target={report} onClose={() => setReport(null)} />
      <SaveConnectionsModal lobby={lobby} open={dialog?.kind === "save"} onClose={close} />
      {dialog?.kind === "leave" && (
        <ConfirmModal
          open
          danger
          title="Keluar dari lobby?"
          confirmLabel="Keluar"
          onClose={close}
          onConfirm={async () => {
            await actions.leave.mutateAsync();
            router.push(`/c/${lobby.course_id}`);
          }}
        >
          <p>
            Kamu bisa bergabung lagi selama masih ada slot.
            {lobby.my_role === "owner" &&
              (lobby.member_count > 1
                ? " Kepemilikan lobby pindah ke anggota yang paling lama bergabung."
                : " Karena kamu sendirian, lobby ini akan ditutup.")}
          </p>
        </ConfirmModal>
      )}
      {dialog?.kind === "close" && (
        <ConfirmModal
          open
          danger
          title="Tutup lobby?"
          confirmLabel="Tutup lobby"
          onClose={close}
          onConfirm={() => actions.close.mutateAsync()}
        >
          <p>Semua anggota hanya bisa membaca chat, dan lobby hilang dari daftar. Ini tidak bisa dibatalkan.</p>
        </ConfirmModal>
      )}
      {dialog?.kind === "delete" && (
        <ConfirmModal
          open
          danger
          title="Hapus pesan ini?"
          confirmLabel="Hapus"
          onClose={close}
          onConfirm={() => chat.remove(dialog.message)}
        >
          <p className="line-clamp-4 rounded-lg bg-raised p-3 text-sm [overflow-wrap:anywhere]">{dialog.message.body}</p>
        </ConfirmModal>
      )}
      {dialog?.kind === "connect" && (
        <ConfirmModal
          open
          title={
            dialog.member.connection === "pending_in"
              ? `Terima koneksi ${dialog.member.user.display_name}?`
              : `Ajukan koneksi ke ${dialog.member.user.display_name}?`
          }
          confirmLabel={dialog.member.connection === "pending_in" ? "Terima" : "Ajukan koneksi"}
          onClose={close}
          onConfirm={async () => {
            await request.mutateAsync({ userId: dialog.member.user.id, courseId: lobby.course_id });
            toast(dialog.member.connection === "pending_in" ? "Kalian sudah terhubung." : "Permintaan terkirim.");
          }}
        >
          <p>{EMAIL_NOTICE}</p>
        </ConfirmModal>
      )}
      {dialog?.kind === "block" && (
        <ConfirmModal
          open
          danger
          title={`Blokir ${dialog.member.user.display_name}?`}
          confirmLabel="Blokir"
          onClose={close}
          onConfirm={async () => {
            await block.mutateAsync(dialog.member.user.id);
            toast("Pengguna diblokir.");
            if (dialog.member.role === "owner") router.push(`/c/${lobby.course_id}`);
          }}
        >
          <p>
            Kalian tidak bisa melihat lobby dan pesan satu sama lain, dan koneksi di antara kalian dihapus. Kamu bisa
            membatalkannya di menu Kamu.
          </p>
        </ConfirmModal>
      )}
      {dialog?.kind === "remove" && (
        <ConfirmModal
          open
          danger
          title={`Keluarkan ${dialog.member.user.display_name}?`}
          confirmLabel="Keluarkan"
          onClose={close}
          onConfirm={() => actions.remove.mutateAsync(dialog.member.user.id)}
        >
          <p>Anggota yang dikeluarkan tidak bisa bergabung lagi ke lobby ini.</p>
        </ConfirmModal>
      )}
    </>
  );
}
