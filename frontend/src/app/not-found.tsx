import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <EmptyState
        title="Halaman ini tidak ada"
        action={
          <Link href="/beranda" className={buttonClass("primary")}>
            Ke Beranda
          </Link>
        }
      >
        Mungkin tautannya salah, atau lobby-nya sudah dihapus setelah semester berakhir.
      </EmptyState>
    </main>
  );
}
