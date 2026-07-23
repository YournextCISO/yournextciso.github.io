# yournextciso.github.io

Personal portfolio site for **YournextCISO** — Cloud Security Engineer, Pentester, DFIR Specialist.

## 🛡️ About

Static HTML/CSS/JS portfolio deployed on GitHub Pages. No build step required — push to `main` and deploy instantly.

## 🧬 Design

Merged from analysis of two reference security portfolio sites:

- **secfortress.com** — Hugo-based dark-themed blog with post cards, reading time, tags, avatar branding
- **chicken0248.fyi** — SOC/cyberpunk aesthetic with tab navigation, dashboard layout, IR-report style project writeups

The result is a **CISO Operations Dashboard** theme: dark solarized palette, tabbed navigation, investigation-report project format, and polished typography.

## 📁 Structure

```
├── index.html              # Home — Operator Profile
├── articles/
│   └── index.html          # Security articles & research
├── projects/
│   └── index.html          # Project writeups (IR-report format)
├── skills/
│   └── index.html          # Certifications, tools, competencies
├── css/
│   └── style.css           # Custom stylesheet (CSS custom properties)
├── js/
│   └── main.js             # Navigation, active tab, uptime counter
├── images/
│   └── avatar.jpg          # Profile avatar (add your own)
├── 404.html                # Custom 404 page
└── README.md
```

## 🚀 Deploy

1. Push this repo to `https://github.com/YournextCISO/yournextciso.github.io`
2. GitHub Pages will automatically deploy the `main` branch
3. Site will be live at `https://yournextciso.github.io`

## 🔧 Customize

- Replace `images/avatar.jpg` with your profile photo
- Update profile name, title, and bio in `index.html`
- Add your actual certifications in `skills/index.html`
- Link your real GitHub and LinkedIn in the footer
- Replace placeholder article/project content with your own