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
      {/* After the page, so their effects see it rendered. Both read the path,
          which isn't known while a new slug's shell is prerendered. */}
      <Suspense>
        <PageTransitions />
        <Preloader />
      </Suspense>
    </>
  );
}
