# tahsinkhan.github.io

Personal research portfolio — clean, minimal, content-driven. The design follows
[al-folio](https://github.com/alshedivat/al-folio): white page, black text, the
theme's default magenta accent (lightened for dark mode), Roboto Slab titles, quiet
hairline structure, no motion. It is a plain Jekyll site with **no gem
dependencies beyond GitHub Pages defaults**, so github.io builds it natively —
no GitHub Actions, no build step to maintain. (Real al-folio needs
jekyll-scholar and a CI build; this keeps the look without the machinery.)

Four pages, al-folio style:

- **`/`** — the *about* landing: brief intro, news, social links.
- **`/research/`** — research areas, publications, research experience.
- **`/projects/`** — filterable card grid. `#slam`, `#learning`, … deep-link
  straight to a filtered view.
- **`/cv/`** — a link to the PDF, education, a compact research-experience
  summary, competitions, technical skills.

---

## Deploying to GitHub Pages

1. Create a **public** repo named exactly `TahsinKhan.github.io`
   (the name must be `<username>.github.io` for the site to live at the root).
2. Push this folder's contents to `main`:

   ```bash
   cd tahsinkhan.github.io
   git init
   git add .
   git commit -m "Portfolio site"
   git branch -M main
   git remote add origin git@github.com:TahsinKhan/TahsinKhan.github.io.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → *Source*: `Deploy from a branch`, branch
   `main`, folder `/ (root)`.
4. Wait ~60 s. Live at `https://TahsinKhan.github.io`.

If the repo is *not* named `<username>.github.io` (say it is `portfolio`), the
site is served from `https://TahsinKhan.github.io/portfolio/` — set
`baseurl: "/portfolio"` in `_config.yml`.

### Custom domain (optional)
Add a `CNAME` file containing just the domain, point DNS at GitHub's IPs, and set
the domain in Settings → Pages.

---

## Editing content

**You should almost never touch HTML.** Everything lives in `_data/*.yml`:

| File | Drives |
|---|---|
| `_data/news.yml` | The dated *news* list on the landing page |
| `_data/research.yml` | `areas`, `publications` and `experience`, all on `/research/` (`experience` also appears as the CV's summary rows) |
| `_data/projects.yml` | The project cards on `/projects/` |
| `_data/competitions.yml` | The *competitions* section of `/cv/` |
| `_data/about.yml` | the landing page's `subtitle` and `intro` paragraphs · `education` and `skills`, both on `/cv/` |
| `_data/nav.yml` | The top navigation |

Identity and contact — the name in the nav and the big heading, email, photo,
affiliation, CV path — live in `_config.yml`, because the nav, footer and page
metadata read the same values.

Common edits:

- **Rewrite the landing-page intro** → `subtitle` and the `intro` list in
  `_data/about.yml`. Each `intro` item is one paragraph; both accept inline HTML
  (`<b>`, `<a href="...">`, `<em>`). No HTML file needs touching.

- **Add a news item** → prepend to `_data/news.yml` (`date` + `text`, newest
  first). `text` accepts inline HTML: `<b>`, `<a>`, `<em>`.
- **Add a paper** → append to `publications` in `_data/research.yml`. Anything
  with `status: Published` is listed first; everything else (`Under review`,
  `In preparation`) is grouped below under *in progress*, and that subheading
  only appears when such an entry exists. Add
  `links: [{label: Paper, url: "..."}, {label: Code, url: "..."}]`. Your own
  name is bolded automatically wherever it appears in `authors`.
- **Add a project** → append to `_data/projects.yml`. `domains` must come from
  `Navigation` / `SLAM` / `Perception` / `Manipulation` / `Learning` / `Hardware`
  — they drive the filter chips on `/projects/` and the `#slam`-style deep links
  the CV's research-areas grid points at. Adding a new domain means adding it to
  the `keys`/`labels` lists at the top of `projects.html` too.
- **Ordering** → `research.experience` and `_data/news.yml` are rendered in file
  order, so keep both newest-first.
- **Add a portrait** → drop the image in `assets/img/` and set
  `author.photo: "/assets/img/you.jpg"` in `_config.yml`. Until then the landing
  page shows a `TK` monogram in its place.
- **Update the CV** → replace `assets/cv/Tahsin_Khan_CV.pdf` (keep the filename,
  or update `author.cv` in `_config.yml`).
- **Email / GitHub / LinkedIn / Scholar / ORCID** → the `author:` block in
  `_config.yml`. Scholar and ORCID icons appear only once those fields are set.
- **Affiliation under the photo** → the `affiliation:` block in `_config.yml`.

### Changing the colour theme

One token, two places — light at the top of `assets/css/main.css`, dark in the
`[data-theme="dark"]` block below it:

```css
:root                { --accent: #b509ac; }   /* al-folio magenta */
[data-theme="dark"]  { --accent: #ea63e0; }   /* lightened magenta, ~6:1 on #1c1c1d */
```

Alternatives that suit this layout: deep teal `#0f766e` / `#5eead4`, indigo
`#4338ca` / `#a5b4fc`, terracotta `#c9481f` / `#ff7a52`. `--accent-ink` is the
text colour used *on top of* the accent — keep it readable.

---

## Running it locally

### Option A — real Jekyll (matches GitHub Pages exactly)

Needs Ruby headers, not installed on this machine yet:

```bash
sudo apt install ruby-dev build-essential zlib1g-dev
gem install --user-install bundler
bundle install
bundle exec jekyll serve --livereload    # → http://localhost:4000
```

### Option B — the bundled preview script (no Ruby needed)

`tools/preview.py` is a ~100-line stand-in that renders these templates with
`python-liquid`. It is a **dev convenience only** — GitHub Pages still builds
with real Jekyll:

```bash
pip install --user python-liquid pyyaml
python3 tools/preview.py .
cd _preview && python3 -m http.server 8777    # → http://localhost:8777
```

---

## Structure

```
_config.yml           site identity, contact links, affiliation, build config
_data/                ← all content lives here
_layouts/             default.html (shell), page.html (inner-page header)
_includes/            head, nav, social, footer, entry, card, pub
assets/css/main.css   plain CSS with custom properties; light + dark tokens
assets/js/site.js     theme toggle, sticky-nav hairline, mobile menu, filters
assets/cv/            the CV PDF
assets/img/           portrait goes here
index.html            the about landing
research.html         publications + research experience
projects.html         the project grid
cv.html               the CV page
404.html
```

### Unused files
`_includes/hero.html` and `assets/js/drive.js` are an interactive
driving-canvas hero that nothing includes, and the CSS it needs (`.drive`,
`.hud`, `hero__*`) is not in this build. Delete them, or say the word and the
hero can be wired back in.
