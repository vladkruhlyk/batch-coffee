import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeJournal } from "@/components/home/journal";

export const metadata: Metadata = {
  title: "Journal — BATCH Coffee",
  description: "Історії ферм, гайди по заварюванню, основи спешіалті кави.",
};

export default function JournalPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-20 lg:pt-24">
        <HomeJournal />
      </main>
      <Footer />
    </>
  );
}
