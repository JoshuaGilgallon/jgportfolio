import { Suspense } from "react";
import { Modal } from "@/components/modal";
import { ProjectDetail } from "@/components/project-detail";
import s from "@/components/modal.module.css";

// prebuild so modals open instantly
export { generateStaticParams } from "../../../projects/[slug]/page";

export default function ProjectModal({ params }: PageProps<"/projects/[slug]">) {
  return (
    <Modal labelledBy="project-title">
      <Suspense fallback={<div className={s.pending} />}>
        <ProjectDetail slug={params.then((p) => p.slug)} inModal />
      </Suspense>
    </Modal>
  );
}
