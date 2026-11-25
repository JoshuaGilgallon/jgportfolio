export const site = {
  name: "Josh",
  fullName: "Joshua Gilgallon",
  description:
    "Josh works on cloud architecture and low-level systems, and cares a great deal about design.",
  url: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};
