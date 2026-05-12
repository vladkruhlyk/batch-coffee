import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeVisit } from "@/components/home/visit";

export const metadata: Metadata = {
  title: "Кав'ярня в Полтаві — BATCH Coffee",
};

export default function VisitPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-20 lg:pt-24">
        <HomeVisit />
      </main>
      <Footer />
    </>
  );
}
