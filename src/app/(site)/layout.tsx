import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

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
    </>
  );
}
