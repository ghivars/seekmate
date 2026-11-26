import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { MATCH_DISCLAIMER } from "@/lib/labels";
import { mockLobby } from "@/lib/mock";
import type { Lobby } from "@/lib/types";
import { JoinBar } from "./join-bar";
import { MatchBreakdown } from "./match-popover";

function renderBar(lobby: Lobby, others: Lobby[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["lobbies", "course", lobby.course_id, {}], [lobby, ...others]);
  const onJoin = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <JoinBar lobby={lobby} onJoin={onJoin} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return onJoin;
}

describe("JoinBar", () => {
  it("invites previewers to join and shows the disclaimer next to the score", async () => {
    const onJoin = renderBar(mockLobby({}));
    expect(screen.getByText(/Kamu sedang melihat pratinjau/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(MATCH_DISCLAIMER))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gabung" }));
    expect(onJoin).toHaveBeenCalled();
  });

  it("offers an alert and similar lobbies when full", () => {
    const similar = mockLobby({ id: "l2", title: "Lobby lain" });
    const joined = mockLobby({ id: "l3", title: "Sudah ikut", is_member: true });
    renderBar(mockLobby({ status: "full" }), [similar, joined]);
    expect(screen.getByRole("button", { name: "Gabung" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Beri tahu jika ada slot" })).toBeEnabled();
    expect(screen.getByRole("link", { name: /Lobby lain/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sudah ikut/)).not.toBeInTheDocument();
  });

  it("hides joining for closed lobbies", () => {
    renderBar(mockLobby({ visibility: "closed" }));
    expect(screen.queryByRole("button", { name: "Gabung" })).not.toBeInTheDocument();
  });
});

describe("MatchBreakdown", () => {
  it("explains every dimension and always carries the disclaimer", () => {
    render(<MatchBreakdown match={mockLobby({}).match!} />);
    for (const label of ["Tujuan", "Suasana", "Waktu", "Gaya komunikasi", "Bahasa"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("35 dari 35 poin")).toBeInTheDocument();
    expect(screen.getByText(MATCH_DISCLAIMER)).toBeInTheDocument();
  });
});
