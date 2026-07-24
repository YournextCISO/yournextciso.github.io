# Content Directory — Obsidian → Site Pipeline

This directory is where you write posts that automatically publish to your site.

## Directory Structure

```
content/
├── posts/              ← Tech blog posts → appear on /blogs/ and homepage
│   ├── .gitkeep
│   ├── my-post.md
│   └── Attachments/    ← Images for your blog posts
│       └── diagram.png
├── dfiring/            ← Personal thoughts → appear on /dfiring/
│   ├── .gitkeep
│   ├── my-thought.md
│   └── Attachments/    ← Images for your DFIRing posts
│       └── photo.jpg
```

## Post Format

Every `.md` file needs YAML frontmatter at the top:

```yaml
---
title: "Your Post Title"
date: 2026-07-25
tags: ["tag1", "tag2", "tag3"]
excerpt: "Optional — auto-generated if omitted"
---

Your markdown content starts here...
```

### Required Fields
- **title**: Post title (displayed in cards and on the post page)
- **date**: Publication date in `YYYY-MM-DD` format

### Optional Fields
- **tags**: List of tags for filtering on the Blog page
- **excerpt**: Custom excerpt (auto-generated from body if omitted)
- **slug**: Custom URL slug (auto-generated from title if omitted)

## How It Works

1. You write notes in Obsidian (or any markdown editor)
2. **Obsidian Git plugin** auto-pushes to GitHub
3. **GitHub Actions** runs `scripts/build_posts.py`:
   - Converts markdown → HTML
   - Copies images from `Attachments/` → `images/posts/{slug}/`
   - Generates `obsidian-posts.json` or `dfiring-posts.json`
   - Creates individual post pages at `/blogs/posts/{slug}/` or `/dfiring/posts/{slug}/`
4. Your site updates automatically via GitHub Pages

## Obsidian Setup

1. Install **Obsidian Git** community plugin
2. Open the `content/` folder as part of your vault
3. Configure Obsidian Git:
   - Set backup interval (e.g., every 10 minutes)
   - Enable "Push on backup"
   - Set auto-pull interval for syncing
4. Write posts in `content/posts/` or `content/dfiring/`
5. Images: drag them into the `Attachments/` folder and reference with `![](Attachments/image.png)`

## Images

- Store images in the `Attachments/` folder within each content type
- Reference them in markdown: `![alt text](Attachments/image.png)`
- The build script automatically copies them to the right location and rewrites paths
- Obsidian wikilinks (`![[image.png]]`) are also supported