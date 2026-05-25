# Graph Report - HostGate.app  (2026-05-25)

## Corpus Check
- 58 files · ~19,646 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 315 edges · 20 communities (12 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a8ca88ca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]

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
10. `FAQ()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Footer()` --calls--> `useI18n()`  [EXTRACTED]
  components/Footer.tsx → lib/i18n.tsx
- `Footer()` --calls--> `pick()`  [EXTRACTED]
  components/Footer.tsx → lib/i18n.tsx
- `Hero()` --calls--> `useI18n()`  [EXTRACTED]
  components/Hero.tsx → lib/i18n.tsx
- `Hero()` --calls--> `pick()`  [EXTRACTED]
  components/Hero.tsx → lib/i18n.tsx
- `Screenshots()` --calls--> `useI18n()`  [EXTRACTED]
  components/Screenshots.tsx → lib/i18n.tsx

## Communities (20 total, 8 thin omitted)

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
- **66 isolated node(s):** `PreToolUse`, `graphify`, `metadata`, `logos`, `nextConfig` (+61 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 0` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `pick()` connect `Community 0` to `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `graphify`, `metadata` to the rest of the system?**
  _66 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11578947368421053 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._