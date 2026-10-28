# ksana.network

The site of [Ksana](https://github.com/ksana-in-bitcoin/ksana), a programmable chain on Bitcoin: the landing page and
the docs, in English and Chinese, built into static files and served by a Cloudflare Worker. The site builds on the Ksana
repository, pinned as the git submodule `core/`: the docs show some of its files verbatim, and the build publishes its
contract reference for AI assistants. The decisions cited here (D-xxx) are those of `core/docs/DECISIONS.md`; the site's
own is D-113.

```sh
git clone --recurse-submodules https://github.com/ksana-in-bitcoin/ksana-site.git
cd ksana-site     # in a clone made without --recurse-submodules: git submodule update --init
npm ci
npm run dev       # http://127.0.0.1:4321, built again on every change
npm run check     # build into dist/, then check links, anchors and the two languages
npm run preview   # links relative to each page, into dist-preview/ (to look at the site from any host)
```

Node 22 (`.node-version`).

## Where things are

| Path | What |
| --- | --- |
| `content/en/landing.mjs`, `content/zh/landing.mjs` | The landing page's copy |
| `content/en/ui.mjs`, `content/zh/ui.mjs` | Interface strings: navigation, footer, search, the figures' labels |
| `content/<language>/docs/*.md` | The docs, one Markdown file per page |
| `site.config.mjs` | The origin, the repository, the signet's addresses and the order of the docs |
| `build.mjs`, `lib/` | The generator: Markdown, highlighting, templates, figures, the landing page's scenes (`lib/scenes.mjs`), checks, and the files for AI assistants (`lib/llms.mjs`) |
| `src/css/`, `src/js/`, `src/fonts/`, `src/img/` | Styles, the two browser scripts, the fonts (OFL) and the images |
| `scripts/` | The Chinese heading font's subset and the share image (run by hand, outputs committed) |
| `wrangler.jsonc` | The Worker: static files, the custom domains |
| `core/` | The Ksana repository, a git submodule at the commit the docs describe |

## The landing page

After its prologue the landing page tells how an operation goes from a signature to final on Bitcoin, in six acts that
the scroll plays (D-125). `lib/landing.mjs` lays them out: `ACTS` gives each act its field (`paper`, `qing`, `mo`,
`night`), its length in screen heights (× 100), the progress at which each paragraph takes over and, for the acts that
carry it, the operation's age and mark at points of the act. `lib/scenes.mjs` draws each act's scene in its final state
and writes on each moving part, as data attributes, between which points of the act's progress it fades, grows, is
drawn, moves, squares its corners or stamps (the list is at the top of the file). `src/js/landing.js` pins an act's
stage while the act is on screen, takes the drawing back to where the scroll stands, shows the operation's mark and age
in the bar at the bottom of the screen, and colors the top bar after the section under it.

With reduced motion, without scripts, or in a browser without the `scripting` media feature, the acts are ordinary
sections: each drawing in its final state, every paragraph showing. Look at the page both ways after changing an act.
The acts' copy is under `acts` in `content/<language>/landing.mjs`, the labels on a drawing under the act's `tags`;
a label is HTML laid over the drawing, so keep it short enough for a drawing 340 px wide.

## Writing a docs page

A page starts with front matter: `title` (the page's heading), `nav` (its label in the sidebar), `lede` (the line under
the title) and an optional `description`. Headings start at `##`. Write the signet's addresses as placeholders, also
inside code: `{{signet.rpc}}`, `{{signet.ws}}`, `{{signet.wallet}}`, `{{signet.indexer}}`, `{{signet.btc}}`,
`{{signet.faucet}}`, `{{signet.p2p}}`, `{{signet.host}}`, and `{{repo}}`, `{{origin}}`. Link pages as `/docs/<page>/`.

A code block marked `from="<path>"` after its language, a path in the Ksana repository (`core/`), shows that file verbatim, or one of
the code blocks of that file when it is Markdown: `npm run check` fails when they differ, so copy the block again after
changing the file. [Your first contract](content/en/docs/first-contract.md) shows the tutorial's contract this way, and
[The contract SDK](content/en/docs/contract-sdk.md) the SDK's listing of the reference for AI assistants.

Blocks: `::: note`, `::: tip`, `::: warning`, `::: danger` (with an optional title), `::: details <summary>`,
`::: code-group <key>` (consecutive code blocks with a `title="..."` become tabs), `::: cards` (a list of
`[Title](/docs/x/) text` items), `::: steps` (each `###` heading inside is a numbered step) and
`::: figure <name>` (`rails`, `supply`, `marks`, `settlement`, `paths`, `architecture`) with a one-line caption. Close
each block with `:::`.

A Chinese page in `content/zh/docs/` has the same name and the same headings, level by level, as its English page; the
Chinese headings take the English anchors. Its links to the signet's web page and to the contract playground ask for
Chinese, as `{{signet.wallet}}?lang=zh-CN` and `{{playground}}?lang=zh-CN`, since both open in English otherwise;
`npm run check` fails on one that does not.
After changing a Chinese heading, make the heading font again:

```sh
python3 -m pip install fonttools brotli
python3 scripts/subset-zh-serif.py <Noto Serif SC SemiBold .ttf>
```

## Files for AI assistants

The build writes three text files at the site's root (llmstxt.org, D-124): `llms.txt`, the English docs with a line on
each page; `llms-full.txt`, every English page in one Markdown file, with the site's own blocks made plain; and
`llms-contracts.txt`, the contract reference for AI assistants, which is `playground/src/ai/ksana-contracts.md` of the
Ksana repository at the commit `core/` pins. The playground's AI assistants page copies the same text, and that
repository's tests hold it to the code. `npm run check` checks the reference's links to this site too.

`_headers` serves the three with `Content-Type: text/plain; charset=utf-8` and `Access-Control-Allow-Origin: *`. Without
the charset, Workers serve `.txt` as plain `text/plain`, which browsers and many HTTP clients read as windows-1252 or
Latin-1, so a `…` became `â€¦`. `npm run check` fails for a text file the build writes with text beyond ASCII and no
charset in `_headers`.

## Deploying

Workers Builds deploys `main`: at every push it runs the build command, which checks the core submodule out and runs
`npm run check` (stopping on a failed check), then `npx wrangler deploy`. The Worker `ksana-site` is connected to this
repository with the root directory left empty and the build command `git submodule update --init && npm run check`,
since Workers Builds does not check submodules out by itself; the deploy attaches `ksana.network` and
`www.ksana.network`, and a redirect rule of the zone sends `www` to `ksana.network`. Moving `core/` to a newer commit of
the Ksana repository is a commit here, which deploys the docs and the contract reference that go with it.

A deploy from a machine runs `npx wrangler deploy` in a checkout with its submodule (Node 22 or later, which wrangler
needs) with `CLOUDFLARE_API_TOKEN` set to a token holding the account's Workers Scripts Edit and the zone's Workers
Routes Edit (the "Edit Cloudflare Workers" template); it builds and checks the site first, as the `build` of
`wrangler.jsonc` says. The first deploy, on 2026-10-15, ran this way.

Cloudflare's Web Analytics is on for the zone with its automatic setup (D-128): Cloudflare adds its beacon script to every page
as it serves it, and the beacon reports to `/cdn-cgi/rum` on the page's own origin. The content security policy allows that script,
from `https://static.cloudflareinsights.com`, and no other script from another origin; the reports need nothing beyond
`connect-src 'self'`. The visits show in the Cloudflare dashboard's Web Analytics.

## License

Licensed under either of the [Apache License, Version 2.0](LICENSE-APACHE) or the [MIT license](LICENSE-MIT) at your
option. Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this
repository, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or
conditions. The fonts in `src/fonts/` are under the SIL Open Font License 1.1 (`OFL.txt` beside them).
