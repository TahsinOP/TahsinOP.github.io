# TahsinOP.github.io

Research portfolio of Tahsin Khan. A plain Jekyll site built by GitHub Pages
itself: no GitHub Actions, no plugins beyond `jekyll-sitemap`, no JS framework.
All content lives in `_data/*.yml`.

Pages:

- **`/`** home: intro, footage reel, research interests, selected work, publications, news
- **`/research/`** research work and publications, with a page per item at `/research/<slug>/`
- **`/projects/`** filterable projects (`#slam`, `#learning`, ... deep-link to a filter),
  mentoring and workshops, competitions; a page per item at `/projects/<slug>/`
- **`/about/`** journey timeline, education, teaching and outreach, skills
- **CV** in the nav opens `assets/cv/CV_NEW.pdf`

## Deploying to GitHub Pages

1. Create a **public** repo named exactly `TahsinOP.github.io`.
2. Push this folder to `main`:

   ```bash
   git init && git add . && git commit -m "Portfolio site"
   git branch -M main
   git remote add origin git@github.com:TahsinOP/TahsinOP.github.io.git
   git push -u origin main
   ```
3. Repo, **Settings, Pages**: deploy from branch `main`, folder `/ (root)`.
4. After about a minute it is live at `https://tahsinop.github.io`.

Videos are served from the repo, so anyone can download them: keep anything
confidential off the site.

## Structure

```
_config.yml            identity, contact links, affiliation, site URL
_data/                 all content (see "Where to edit what")
_layouts/              default (shell), page (inner pages), detail (project pages)
_includes/             card, row, media-well, fig, block, yt, pub, link, topics, nav, footer
research/, projects/   one-line stubs made by tools/make_pages.py
assets/css/main.css    the only stylesheet: tokens, then components
assets/js/site.js      theme, menu, filters, reel, reveals, YouTube, gallery, lightbox
assets/img/<slug>/     images (+ -thumb copies);  assets/video/<slug>/  videos
tools/                 page stubs, thumbnails, Jekyll build, link and browser checks
```

## Colours and type

Tokens sit at the top of `assets/css/main.css`: light under `:root`, dark under
`[data-theme="dark"]`. The accent is `--accent` (`#8a1c7c` light, `#e58ad9` dark,
both above 7:1 contrast). Topic chip colours are in `_data/topics.yml`; the CSS
darkens or lightens them so every chip stays above 4.5:1 in both themes.

## Where to edit what

All content lives in `_data/` (YAML). You rarely need to touch the HTML.

| What you see | File |
|---|---|
| Home intro paragraphs | `_data/about.yml` → `intro` |
| Name, role, photo, email, socials, CV link | `_config.yml` → `author`, `affiliation` |
| Research interests (home) | `_data/research.yml` → `interests` |
| Featured cards (home), and their order | `_data/featured.yml` (list of `ref: <slug>`) |
| News (home) | `_data/news.yml` (newest first) |
| Research items: card, row, detail page | `_data/research.yml` → `work` |
| Publications | `_data/research.yml` → `publications` |
| Projects / competitions | `_data/projects.yml`, `_data/competitions.yml` |
| Mentored projects | `_data/mentoring.yml` |
| Workshops (projects page) | `_data/about.yml` → `workshops` |
| Journey timeline (about) | `_data/timeline.yml` (`kind: role` or `kind: milestone`) |
| About bio, education, outreach, skills | `_data/about.yml` → `bio`, `education`, `outreach`, `skills` |
| Nav items | `_data/nav.yml` |
| The CV PDF | replace `assets/cv/CV_NEW.pdf` |

### Adding a research item or project

1. Copy an existing entry in `_data/research.yml` (`work:`) or `_data/projects.yml`
   and give it a new `slug` (lowercase-with-dashes).
2. Put media in `assets/img/<slug>/` and `assets/video/<slug>/`.
   Keep videos small: `ffmpeg -i in.mp4 -c:v libx264 -crf 27 -vf scale=-2:720 -an -movflags +faststart out.mp4`.
3. Fill in the fields (all are described at the top of `_data/research.yml`):
   `cover` (card image), `card` (card text), `summary`, `stack` (3-4 keywords),
   `links`, `hero` (the main video), `body` (text, `h:` subheadings, small
   `img:`/`video:`/`youtube:` blocks) and `gallery` (scrollable strip).
4. Run `python3 tools/make_pages.py` to create its detail page.
5. To feature it on the home page, add `- ref: <slug>` to `_data/featured.yml`.

### Adding a timeline entry

```yaml
- kind:  role                    # or: milestone (just date + text)
  date:  "Aug 2025 - Present"    # "Present" makes the dot pulse
  title: "Senior Project Technical Assistant"
  org:   "ERTS Lab (e-Yantra), IIT Bombay"
  text:  "One line on what you did."
  link:  /research/              # optional
  logo:  /assets/img/logos/iitb.png   # optional small org logo
```

### Adding a skill

In `_data/about.yml` → `skills`, add `{ name: PyTorch, logo: pytorch, color: "#EE4C2C" }`
after downloading `https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/pytorch.svg`
into `assets/img/logos/`. With no logo available, use `{ name: Nav2, mark: "N2" }`
(always quote the mark).

### Build and check locally

GitHub Pages builds the site itself on every push; nothing needs to be committed
except the source. To check a change before pushing:

```
python3 tools/make_pages.py            # after adding/removing an item
python3 tools/optimise_media.py        # after adding images (makes -thumb copies)
ruby --disable-gems tools/jekyll_build.rb _site   # real Jekyll 3.10 build, like GitHub Pages
python3 tools/check_links.py _site     # every local link, image and anchor
python3 -m http.server 8080 -d _site   # then open http://127.0.0.1:8080
python3 tools/browser_check.py         # keyboard, focus, reduced motion, mobile overflow
```

`jekyll_build.rb` needs Jekyll's pure-Ruby gems once:
`gem install --user-install --ignore-dependencies jekyll:3.10.0 liquid:4.0.4 kramdown:2.4.0 kramdown-parser-gfm:1.1.0 rouge:3.30.0 safe_yaml:1.0.5 mercenary:0.3.6 colorator:1.1.0 pathutil:0.16.2 forwardable-extended:2.6.0 addressable:2.8.7 public_suffix:5.1.1 i18n:1.14.6 concurrent-ruby:1.3.4 jekyll-sass-converter:1.5.2 sass:3.7.4 jekyll-sitemap:1.4.0 webrick:1.8.2 rexml:3.3.9`.
Without Ruby, `python3 tools/preview.py .` renders an approximate preview into `_preview/`.

### Design notes

- One stylesheet, `assets/css/main.css`, organised by section with colour and
  type tokens at the top (light and dark). Fonts: Source Serif 4 for headings,
  Inter for text.
- One card component (`_includes/card.html`) in two sizes; the first entry of
  `_data/featured.yml` becomes the large lead card on the home page.
- The home page footage reel is `assets/video/reel/reel.mp4` (about 17 s, silent);
  `_data/reel.yml` says which project each part shows.
- Each detail page shows `contributions` first, then the write-up and gallery;
  keep contributions to what you did, from the CV.
- Motion: one page-load sequence plus light scroll reveals; all of it switches
  off for visitors with reduced motion, and the reel starts paused for them.
