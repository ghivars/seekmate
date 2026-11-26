"use client";

import { useParams } from "next/navigation";
import { Page } from "@/components/shell/page";
import { LobbyView } from "@/components/lobby/lobby-view";
import { ErrorState, SkeletonList } from "@/components/ui/states";
import { useLobby } from "@/lib/data";

export default function LobbyPage() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const lobby = useLobby(lobbyId);
  if (lobby.data) return <LobbyView key={lobbyId} lobby={lobby.data} />;
  return (
    <Page title="Lobby">
      {lobby.isError ? (
        <ErrorState error={lobby.error} onRetry={() => void lobby.refetch()} />
      ) : (
        <SkeletonList rows={6} className="h-14" />
      )}
    </Page>
  );
}
