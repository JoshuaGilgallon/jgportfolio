/**
 * Describes each kind of entry the admin can manage. Shared by the server
 * (validation, queries) and the client (rendering the editor form).
 */

export type FieldType = "text" | "textarea" | "markdown" | "url" | "date" | "toggle" | "select";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  half?: boolean;
  options?: { value: string; label: string }[];
};

export type ContentTypeConfig = {
  label: string;
  singular: string;
  ordered: boolean;
  fields: Field[];
};

const published: Field = { name: "published", label: "Published", type: "toggle", hint: "Visible on the site." };

export const contentTypes = {
  posts: {
    label: "Posts",
    singular: "post",
    ordered: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", placeholder: "Generated from the title", half: true },
      { name: "date", label: "Date", type: "date", required: true, half: true },
      { name: "summary", label: "Summary", type: "textarea", hint: "One or two sentences, shown in lists and previews." },
      { name: "body", label: "Body", type: "markdown" },
      published,
    ],
  },
  projects: {
    label: "Projects",
    singular: "project",
    ordered: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", placeholder: "Generated from the title", half: true },
      { name: "year", label: "Year", type: "text", placeholder: "2025", half: true },
      { name: "summary", label: "Summary", type: "textarea", hint: "One or two sentences for the card." },
      { name: "tags", label: "Stack", type: "text", placeholder: "Rust, eBPF, Linux", hint: "Comma separated." },
      { name: "url", label: "Website", type: "url", placeholder: "https://", half: true },
      { name: "repoUrl", label: "Source", type: "url", placeholder: "https://github.com/…", half: true },
      {
        name: "body",
        label: "Write-up",
        type: "markdown",
        hint: "Optional. Shown below the summary and links when the project opens.",
      },
      published,
    ],
  },
  publications: {
    label: "Publications",
    singular: "publication",
    ordered: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "authors", label: "Authors", type: "text", placeholder: "J. Gilgallon, A. Author" },
      { name: "venue", label: "Venue", type: "text", placeholder: "Conference or journal", half: true },
      { name: "year", label: "Year", type: "text", placeholder: "2025", half: true },
      { name: "url", label: "Link", type: "url", placeholder: "https://" },
      published,
    ],
  },
  links: {
    label: "Links",
    singular: "link",
    ordered: true,
    fields: [
      {
        name: "kind",
        label: "Type",
        type: "select",
        half: true,
        options: [
          { value: "email", label: "Email" },
          { value: "github", label: "GitHub" },
          { value: "discord", label: "Discord" },
          { value: "linkedin", label: "LinkedIn" },
          { value: "x", label: "X" },
          { value: "website", label: "Website" },
        ],
      },
      { name: "label", label: "Label", type: "text", required: true, placeholder: "GitHub", half: true },
      { name: "value", label: "Shown as", type: "text", required: true, placeholder: "Username or address" },
      {
        name: "href",
        label: "URL",
        type: "url",
        placeholder: "https://",
        hint: "Email fills this in for you. Leave it empty and the row copies its value instead, which suits Discord.",
      },
      { ...published, label: "Visible", hint: "Shown in the Contact section." },
    ],
  },
} satisfies Record<string, ContentTypeConfig>;

export type ContentType = keyof typeof contentTypes;

export const contentTypeKeys = Object.keys(contentTypes) as ContentType[];

export const isContentType = (value: string): value is ContentType => value in contentTypes;

/** Every editable value travels to the form as a string or boolean. */
export type EntryValues = Record<string, string | boolean>;

export type SaveState = {
  ok?: boolean;
  savedAt?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
};
