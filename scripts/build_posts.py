"""
Build Obsidian Posts — Converts Markdown notes to static HTML pages
and generates obsidian-posts.json metadata for the site.

Reads from:  content/posts/*.md
Writes to:   blogs/posts/{slug}/index.html
             obsidian-posts.json
Copies:      content/posts/Attachments/* → images/posts/{slug}/
"""

import json
import os
import re
import shutil
import sys
from pathlib import Path

try:
    import markdown
    import yaml
except ImportError:
    print("ERROR: Install dependencies: pip install markdown pyyaml")
    sys.exit(1)


# Paths relative to repo root
CONTENT_DIR = Path("content/posts")
OUTPUT_POSTS_DIR = Path("blogs/posts")
IMAGES_OUTPUT_DIR = Path("images/posts")
JSON_OUTPUT = Path("obsidian-posts.json")
ATTACHMENTS_DIR = CONTENT_DIR / "Attachments"

# Post template (will read from file)
TEMPLATE_PATH = Path("scripts/post-template.html")

SITE_TITLE = "YournextCISO"
SITE_DESCRIPTION = "SOC Analyst | Blue Team | DFIR"


def slugify(text):
    """Convert a title to a URL-friendly slug."""
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def parse_frontmatter(content):
    """Extract YAML frontmatter and body from markdown content."""
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    try:
        meta = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        meta = {}
        print(f"  WARNING: Could not parse frontmatter")

    return meta, parts[2].strip()


def extract_excerpt(body, max_chars=250):
    """Extract a plain-text excerpt from the markdown body."""
    # Remove HTML tags
    clean = re.sub(r"<[^>]+>", "", body)
    # Remove markdown link syntax
    clean = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", clean)
    # Remove images
    clean = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", clean)
    # Remove heading markers
    clean = re.sub(r"^#+\s*", "", clean, flags=re.MULTILINE)
    # Remove code fences
    clean = re.sub(r"```[\s\S]*?```", "", clean)
    # Collapse whitespace
    clean = re.sub(r"\s+", " ", clean).strip()

    if len(clean) > max_chars:
        clean = clean[:max_chars].rsplit(" ", 1)[0] + "…"

    return clean


def fix_image_paths(html_body, slug):
    """
    Rewrite image paths from Obsidian-style Attachments/ references
    to the deployed images/posts/{slug}/ paths.
    Also handles Obsidian-style wikilinks for images.
    """
    # Standard markdown images: ![alt](Attachments/file.png)
    html_body = re.sub(
        r'src="Attachments/([^"]+)"',
        rf'src="/images/posts/{slug}/\1"',
        html_body
    )

    # Also handle src paths that might be relative like ../Attachments/
    html_body = re.sub(
        r'src="(?:\.\./)?content/posts/Attachments/([^"]+)"',
        rf'src="/images/posts/{slug}/\1"',
        html_body
    )

    # Handle Obsidian wikilink images: ![[file.png]]
    html_body = re.sub(
        r'!\[\[([^\]]+\.(?:png|jpg|jpeg|gif|svg|webp|bmp))\]\]',
        rf'<img src="/images/posts/{slug}/\1" alt="\1" loading="lazy">',
        html_body
    )

    return html_body


def copy_attachments(slug, frontmatter):
    """
    Copy attachment images for a post.
    Looks in content/posts/Attachments/ for files referenced in the markdown.
    """
    dest_dir = IMAGES_OUTPUT_DIR / slug
    dest_dir.mkdir(parents=True, exist_ok=True)

    # If there's a specific attachments key in frontmatter, use that
    explicit_files = frontmatter.get("attachments", [])

    if explicit_files:
        for fname in explicit_files:
            src = ATTACHMENTS_DIR / fname
            if src.exists():
                dest = dest_dir / fname
                shutil.copy2(src, dest)
                print(f"  Copied: {fname}")
            else:
                print(f"  WARNING: Attachment not found: {fname}")
    else:
        # No explicit list — copy all files from Attachments dir
        # (This is a best-effort; individual post image dirs would be ideal)
        if ATTACHMENTS_DIR.exists():
            copied = 0
            for f in ATTACHMENTS_DIR.iterdir():
                if f.is_file():
                    dest = dest_dir / f.name
                    shutil.copy2(f, dest)
                    copied += 1
            if copied:
                print(f"  Copied {copied} attachment(s)")


def build_post_page(md_file, slug, title, date_str, tags, html_body, template):
    """Generate an individual post HTML page from the template."""
    tags_html = ""
    if tags:
        tag_spans = "".join(
            f'<span class="tag">{t}</span>' for t in tags
        )
        tags_html = f'<div class="post-tags">{tag_spans}</div>'

    html = template
    html = html.replace("{{TITLE}}", title)
    html = html.replace("{{DATE}}", date_str or "")
    html = html.replace("{{TAGS}}", tags_html)
    html = html.replace("{{CONTENT}}", html_body)
    html = html.replace("{{SLUG}}", slug)

    return html


def main():
    print("=== Building Obsidian Posts ===\n")

    if not CONTENT_DIR.exists():
        print(f"Content directory '{CONTENT_DIR}' does not exist. Nothing to build.")
        # Create empty JSON file
        JSON_OUTPUT.write_text("[]", encoding="utf-8")
        print(f"Created empty {JSON_OUTPUT}")
        return

    # Read post template
    if TEMPLATE_PATH.exists():
        template = TEMPLATE_PATH.read_text(encoding="utf-8")
    else:
        print(f"ERROR: Template not found at {TEMPLATE_PATH}")
        sys.exit(1)

    # Find all markdown files (exclude README.md, index.md)
    md_files = sorted(
        [f for f in CONTENT_DIR.glob("*.md")
         if f.name.lower() not in ("readme.md", "index.md")],
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )

    if not md_files:
        print("No markdown posts found.")
        JSON_OUTPUT.write_text("[]", encoding="utf-8")
        return

    print(f"Found {len(md_files)} markdown file(s)\n")

    # Clear and recreate output directories
    if OUTPUT_POSTS_DIR.exists():
        shutil.rmtree(OUTPUT_POSTS_DIR)
    OUTPUT_POSTS_DIR.mkdir(parents=True, exist_ok=True)

    posts_meta = []

    for md_file in md_files:
        print(f"Processing: {md_file.name}")

        raw_content = md_file.read_text(encoding="utf-8")
        frontmatter, body_md = parse_frontmatter(raw_content)

        # Extract metadata
        title = frontmatter.get("title", md_file.stem.replace("-", " ").title())
        date_str = str(frontmatter.get("date", ""))
        tags = frontmatter.get("tags", [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",")]
        excerpt = frontmatter.get("excerpt", "")

        # Generate slug
        slug = frontmatter.get("slug", slugify(title))

        # Convert markdown body to HTML
        md_extensions = ["fenced_code", "codehilite", "tables", "toc", "nl2br"]
        try:
            html_body = markdown.markdown(body_md, extensions=md_extensions)
        except Exception:
            html_body = markdown.markdown(body_md)

        # Fix image paths
        html_body = fix_image_paths(html_body, slug)

        # Generate excerpt if not provided
        if not excerpt:
            excerpt = extract_excerpt(body_md)

        # Copy attachments
        copy_attachments(slug, frontmatter)

        # Write individual post page
        post_dir = OUTPUT_POSTS_DIR / slug
        post_dir.mkdir(parents=True, exist_ok=True)
        post_html = build_post_page(md_file, slug, title, date_str, tags, html_body, template)
        (post_dir / "index.html").write_text(post_html, encoding="utf-8")
        print(f"  Generated: /blogs/posts/{slug}/")

        posts_meta.append({
            "title": title,
            "date": date_str,
            "tags": tags,
            "excerpt": excerpt,
            "slug": slug,
            "url": f"/blogs/posts/{slug}/"
        })

    # Write obsidian-posts.json
    JSON_OUTPUT.write_text(
        json.dumps(posts_meta, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"\nWrote {len(posts_meta)} posts to {JSON_OUTPUT}")
    print("=== Done ===")


if __name__ == "__main__":
    main()