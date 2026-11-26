import { ContactList } from "@/components/contact-list";
import { HomeMark, HomeNav } from "@/components/home-nav";
import { List, Row } from "@/components/list";
import { ProjectCard, ProjectGrid } from "@/components/project-card";
import { Section } from "@/components/section";
import { TextLink } from "@/components/text-link";
import { getLinks, getPosts, getProjects, getPublications } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { homeSections } from "@/lib/sections";
import s from "./home.module.css";

const RECENT_POSTS = 5;

export default async function Home() {
  const [projects, posts, publications, links] = await Promise.all([
    getProjects(),
    getPosts(),
    getPublications(),
    getLinks(),
  ]);

  return (
    <>
      <HomeMark />
      <header className={s.hero}>
        <h1 className={s.title}>Hi, I’m Josh.</h1>
        <p className={s.lead}>
          I work on <em>cloud architecture</em> and <em>low‑level systems</em>, the two ends of the stack
          that most people never see.
        </p>
        <div className={s.about}>
          <p>
            At the top, that means infrastructure that scales quietly, fails gracefully, and stays easy
            to reason about. At the bottom, it means memory, concurrency, and the instructions that
            actually run on the machine.
          </p>
          <p>
            Holding it all together is a love of design. I think good software should feel obvious:
            nothing missing, nothing extra. That goes for an API, a command-line tool, and a page like
            this one.
          </p>
        </div>
      </header>

      {projects.length > 0 && (
        <Section id="projects" title="Projects">
          <ProjectGrid>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ProjectGrid>
        </Section>
      )}

      {posts.length > 0 && (
        <Section
          id="writing"
          title="Writing"
          action={posts.length > RECENT_POSTS && <TextLink href="/writing">All writing</TextLink>}
        >
          <List>
            {posts.slice(0, RECENT_POSTS).map((post) => (
              <Row
                key={post.slug}
                href={`/writing/${post.slug}`}
                title={post.title}
                subtitle={post.summary}
                meta={<time dateTime={post.date.toISOString()}>{formatDate(post.date)}</time>}
              />
            ))}
          </List>
        </Section>
      )}

      {publications.length > 0 && (
        <Section id="publications" title="Publications">
          <List>
            {publications.map((pub) => (
              <Row
                key={pub.id}
                href={pub.url || undefined}
                title={pub.title}
                subtitle={[pub.authors, pub.venue].filter(Boolean).join(" · ")}
                meta={pub.year}
              />
            ))}
          </List>
        </Section>
      )}

      {links.length > 0 && (
        <Section id="contact" title="Contact">
          <p className={s.contact}>I’m always happy to talk about systems, infrastructure, or design.</p>
          <ContactList links={links} />
        </Section>
      )}

      <HomeNav
        sections={homeSections({ projects: projects.length, posts: posts.length, links: links.length })}
      />
    </>
  );
}
