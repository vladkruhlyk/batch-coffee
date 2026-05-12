import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeAbout } from "@/components/home/about";

export const metadata: Metadata = {
  title: "Про нас — BATCH Coffee",
  description: "BATCH — маленька ростерія у Полтаві з великою уважністю до кави.",
};

export default function AboutPage() {
  return (
    <>
      <Header overlay />
      <main className="flex-1">
        <HomeAbout />
      </main>
      <Footer />
    </>
  );
}
