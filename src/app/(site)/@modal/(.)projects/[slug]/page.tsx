import { Suspense } from "react";
import { Modal } from "@/components/modal";
import { ProjectDetail } from "@/components/project-detail";
import s from "@/components/modal.module.css";

// Pre-build every project's modal (including its highlighted write-up), so
// opening one is instant, even on a freshly started server.
export { generateStaticParams } from "../../../projects/[slug]/page";

/** A project link clicked on the home page opens here, over the page. */
export default function ProjectModal({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Modal labelledBy="project-title">
      <Suspense fallback={<div className={s.pending} />}>
        <ProjectDetail slug={params.then((p) => p.slug)} inModal />
      </Suspense>
    </Modal>
  );
}
