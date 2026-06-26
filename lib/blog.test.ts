import { describe, it, expect } from "vitest";
import { blogPosts, getPost } from "./blog";

describe("getPost", () => {
  it("returns the correct post for a known slug", () => {
    const post = getPost("boost-direct-bookings");
    expect(post).toBeDefined();
    expect(post?.slug).toBe("boost-direct-bookings");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getPost("this-slug-does-not-exist")).toBeUndefined();
  });

  it("every blogPost is retrievable by its own slug", () => {
    for (const p of blogPosts) {
      expect(getPost(p.slug)).toBe(p);
    }
  });
});

describe("blogPosts", () => {
  it("has no duplicate slugs", () => {
    const slugs = blogPosts.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });
});
