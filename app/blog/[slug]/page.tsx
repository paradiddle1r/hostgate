import { notFound } from "next/navigation";
import { blogPosts, getPost } from "@/lib/blog";
import PostView from "./PostView";

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title.en,
    description: post.excerpt.en,
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) return notFound();
  return <PostView slug={params.slug} />;
}
