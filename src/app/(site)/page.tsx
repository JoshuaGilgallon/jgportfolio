import { ContactList } from "@/components/contact-list";
import { HomeMark, HomeNav } from "@/components/home-nav";
import { List, Row } from "@/components/list";
import { ProjectCard, ProjectGrid } from "@/components/project-card";
import { Key, Reveal } from "@/components/reveal";
import { RevealOnce } from "@/components/reveal-once";
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
        <h1 className={s.title}>
          <Reveal tier="title" at={120} step={80}>
            Hi, I’m <Key>Josh.</Key>
          </Reveal>
        </h1>
        <p className={s.lead}>
          <Reveal tier="lead" at={340} step={36}>
            I work on <em>cloud architecture</em> and <em>low‑level systems</em>.
          </Reveal>
        </p>
        <div className={s.about}>
          <Reveal tier="body" at={540} step={12}>
            <p>
              Here’s a spot for some text that i need to add but i am very lazy
            </p>
            <p>
              And another paragraph here for retention
            </p>
          </Reveal>
        </div>
        <RevealOnce />
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
