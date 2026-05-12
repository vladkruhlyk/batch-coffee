import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomeSubscription } from "@/components/home/subscription";

export const metadata: Metadata = {
  title: "Підписка — BATCH Coffee",
  description:
    "Щомісячна підписка на свіжообсмажену каву. Обирай сорти, метод і ритм.",
};

export default function SubscriptionPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-20 lg:pt-24">
        <HomeSubscription />
      </main>
      <Footer />
    </>
  );
}
