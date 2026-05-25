# Graph Report - /Users/pornchai/Documents/HostGate.app  (2026-05-25)

## Corpus Check
- Corpus is ~16,207 words - fits in a single context window. You may not need a graph.

## Summary
- 188 nodes · 312 edges · 18 communities (12 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 39 edges
2. `pick()` - 36 edges
3. `compilerOptions` - 16 edges
4. `SectionHeader()` - 9 edges
5. `getPost()` - 6 edges
6. `scripts` - 5 edges
7. `useReveal()` - 5 edges
8. `PostView()` - 4 edges
9. `blogPosts` - 4 edges
10. `ContactView()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `ContactView()` --calls--> `useI18n()`  [EXTRACTED]
  app/contact/ContactView.tsx → lib/i18n.tsx
- `ContactView()` --calls--> `pick()`  [EXTRACTED]
  app/contact/ContactView.tsx → lib/i18n.tsx
- `BlogPage()` --calls--> `useI18n()`  [EXTRACTED]
  app/blog/page.tsx → lib/i18n.tsx
- `BlogPage()` --calls--> `pick()`  [EXTRACTED]
  app/blog/page.tsx → lib/i18n.tsx
- `PostView()` --calls--> `useI18n()`  [EXTRACTED]
  app/blog/[slug]/PostView.tsx → lib/i18n.tsx

## Communities (18 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (18): Comparison(), CTA(), FAQ(), Features(), icons, SectionHeader(), HowItWorks(), Integrations (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (23): dependencies, next, react, react-dom, @supabase/supabase-js, devDependencies, autoprefixer, eslint (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (5): ContactView(), metadata, ContactSubmission, submitContact(), supabase

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (7): BlogPage(), BlogPost, blogPosts, getPost(), generateMetadata(), PostPage(), PostView()

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (8): metadata, Footer(), I18nContext, I18nContextValue, I18nProvider(), Locale, TranslationKey, translations

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (9): LegalLayout(), bodyEn, bodyTh, metadata, title, bodyEn, bodyTh, metadata (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.39
Nodes (4): AnimatedCounter(), Reveal(), Variant, useReveal()

## Knowledge Gaps
- **64 isolated node(s):** `nextConfig`, `config`, `name`, `version`, `private` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 0` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `pick()` connect `Community 0` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `nextConfig`, `config`, `name` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11578947368421053 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._