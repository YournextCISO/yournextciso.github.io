"""
Build Obsidian/DFIRing Posts — Converts Markdown notes to static HTML pages
and generates JSON metadata for the site.

Usage:
  python scripts/build_posts.py
    → Builds content/posts/ → obsidian-posts.json + blogs/posts/{slug}/

  python scripts/build_posts.py --type dfiring
    → Builds content/dfiring/ → dfiring-posts.json + dfiring/posts/{slug}/

Reads from:  content/{posts|dfiring}/*.md
Writes to:   {obsidian|dfiring}-posts.json
             blogs/posts/{slug}/index.html  OR  dfiring/posts/{slug}/index.html
Copies:      content/{posts|dfiring}/Attachments/* → images/{posts|dfiring}/{slug}/
"""

import argparse
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


# Paths relative to repo root (defaults, overridden by --type)
ROOT = Path(__file__).resolve().parent.parent

# Post template
TEMPLATE_PATH = ROOT / "scripts" / "post-template.html"

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


def fix_image_paths(html_body, slug, content_type):
    """
    Rewrite image paths from Obsidian-style Attachments/ references
    to the deployed images/{content_type}/{slug}/ paths.
    Also handles Obsidian-style wikilinks for images.
    """
    # Standard markdown images: ![alt](Attachments/file.png)
    html_body = re.sub(
        r'src="Attachments/([^"]+)"',
        rf'src="/images/{content_type}/{slug}/\1"',
        html_body
    )

    # Also handle src paths that might be relative like ../Attachments/
    html_body = re.sub(
        r'src="(?:\.\./)?(?:content/(?:posts|dfiring)/)?Attachments/([^"]+)"',
        rf'src="/images/{content_type}/{slug}/\1"',
        html_body
    )

    # Handle Obsidian wikilink images: ![[file.png]]
    html_body = re.sub(
        r'!\[\[([^\]]+\.(?:png|jpg|jpeg|gif|svg|webp|bmp))\]\]',
        rf'<img src="/images/{content_type}/{slug}/\1" alt="\1" loading="lazy">',
        html_body
    )

    return html_body


def copy_attachments(slug, attachments_dir, images_dir, frontmatter):
    """
    Copy attachment images for a post.
    """
    dest_dir = images_dir / slug
    dest_dir.mkdir(parents=True, exist_ok=True)

    explicit_files = frontmatter.get("attachments", [])

    if explicit_files:
        for fname in explicit_files:
            src = attachments_dir / fname
            if src.exists():
                shutil.copy2(src, dest_dir / fname)
                print(f"  Copied: {fname}")
            else:
                print(f"  WARNING: Attachment not found: {fname}")
    else:
        if attachments_dir.exists():
            copied = 0
            for f in attachments_dir.iterdir():
                if f.is_file():
                    shutil.copy2(f, dest_dir / f.name)
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


def build(config):
    """Build posts for a given content type config."""
    content_dir = ROOT / config["content_dir"]
    output_posts_dir = ROOT / config["output_dir"]
    images_dir = ROOT / config["images_dir"]
    json_output = ROOT / config["json_output"]
    attachments_dir = content_dir / "Attachments"
    content_type = config["type"]

    print(f"\n=== Building {content_type} Posts ===\n")

    if not content_dir.exists():
        print(f"Content directory '{content_dir}' does not exist. Nothing to build.")
        json_output.write_text("[]", encoding="utf-8")
        print(f"Created empty {json_output}")
        return

    # Read post template
    if TEMPLATE_PATH.exists():
        template = TEMPLATE_PATH.read_text(encoding="utf-8")
    else:
        print(f"ERROR: Template not found at {TEMPLATE_PATH}")
        sys.exit(1)

    # Find all markdown files (exclude README.md, index.md)
    md_files = sorted(
        [f for f in content_dir.glob("*.md")
         if f.name.lower() not in ("readme.md", "index.md")],
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )

    if not md_files:
        print("No markdown posts found.")
        json_output.write_text("[]", encoding="utf-8")
        return

    print(f"Found {len(md_files)} markdown file(s)\n")

    # Clear and recreate output directories
    if output_posts_dir.exists():
        shutil.rmtree(output_posts_dir)
    output_posts_dir.mkdir(parents=True, exist_ok=True)

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
        html_body = fix_image_paths(html_body, slug, content_type)

        # Generate excerpt if not provided
        if not excerpt:
            excerpt = extract_excerpt(body_md)

        # Copy attachments
        copy_attachments(slug, attachments_dir, images_dir, frontmatter)

        # Write individual post page
        post_dir = output_posts_dir / slug
        post_dir.mkdir(parents=True, exist_ok=True)
        post_html = build_post_page(md_file, slug, title, date_str, tags, html_body, template)
        (post_dir / "index.html").write_text(post_html, encoding="utf-8")
        print(f"  Generated: /{config['output_dir']}/{slug}/")

        posts_meta.append({
            "title": title,
            "date": date_str,
            "tags": tags,
            "excerpt": excerpt,
            "slug": slug,
            "url": f"/{config['output_dir']}/{slug}/"
        })

    # Write JSON output
    json_output.write_text(
        json.dumps(posts_meta, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"\nWrote {len(posts_meta)} posts to {json_output}")
    print("=== Done ===")


def main():
    parser = argparse.ArgumentParser(description="Build posts from markdown content")
    parser.add_argument("--type", choices=["obsidian", "dfiring"], default="obsidian",
                        help="Content type to build (default: obsidian)")
    args = parser.parse_args()

    configs = {
        "obsidian": {
            "type": "posts",
            "content_dir": "content/posts",
            "output_dir": "blogs/posts",
            "images_dir": "images/posts",
            "json_output": "obsidian-posts.json",
        },
        "dfiring": {
            "type": "dfiring",
            "content_dir": "content/dfiring",
            "output_dir": "dfiring/posts",
            "images_dir": "images/dfiring",
            "json_output": "dfiring-posts.json",
        }
    }

    if args.type == "obsidian":
        build(configs["obsidian"])
    elif args.type == "dfiring":
        build(configs["dfiring"])


if __name__ == "__main__":
    main()