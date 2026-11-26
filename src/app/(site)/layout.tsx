import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { PageTransitions } from "@/components/page-transitions";
import { Preloader } from "@/components/preloader";

export default function SiteLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main" className="page">
        {children}
      </main>
      <Footer />
      {modal}
      {/* after the page so its effects run first */}
      <Suspense>
        <PageTransitions />
        <Preloader />
      </Suspense>
    </>
  );
}
