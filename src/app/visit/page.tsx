import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeVisit } from "@/components/home/visit";
import { fetchSiteSettings } from "@/sanity/lib/fetchers";

export const metadata: Metadata = {
  title: "Кав'ярня в Полтаві — BATCH Coffee",
};

export const revalidate = 60;

export default async function VisitPage() {
  const settings = await fetchSiteSettings();
  return (
    <>
      <Header />
      <main className="flex-1 pt-20 lg:pt-24">
        <HomeVisit imageUrl={settings.visitPhotoUrl} />
      </main>
      <Footer />
    </>
  );
}
