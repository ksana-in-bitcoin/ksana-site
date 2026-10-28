#!/usr/bin/env python3
"""The face of the Chinese headings: Noto Serif SC SemiBold, cut down to the characters the Chinese pages set in it.

    python3 -m pip install fonttools brotli
    python3 scripts/subset-zh-serif.py <Noto Serif SC SemiBold, .ttf or .otf>

The source font is Noto Serif SC at weight 600 (the static TTF Google Fonts serves for it, or NotoSerifSC-SemiBold.otf
of notofonts/noto-cjk), under the SIL Open Font License like the other faces in src/fonts/ (OFL.txt). The script builds
the site with `node build.mjs --serif-text`, which prints the text the Chinese pages set in the heading face, and writes
src/fonts/ksana-serif-sc.woff2 holding those characters and the punctuation a Chinese heading may use, about a hundred
kilobytes instead of the source's fourteen megabytes. Run it again after changing a Chinese heading:
`node build.mjs --check` fails while the subset lacks a character the pages need.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from fontTools import subset

SITE = Path(__file__).resolve().parent.parent
OUT = SITE / 'src/fonts/ksana-serif-sc.woff2'

# The unicode-range of the face in src/css/01-fonts.css: the browser takes only these characters from it.
RANGES = [(0x2014, 0x2014), (0x2018, 0x2019), (0x201C, 0x201D), (0x2026, 0x2026), (0x3000, 0x303F), (0x3400, 0x4DBF),
          (0x4E00, 0x9FFF), (0xFF00, 0xFFEF)]

# The punctuation of a Chinese heading, kept whether or not a heading uses it today.
PUNCTUATION = ''.join(chr(code) for code in (
    0x3000, 0x3001, 0x3002, 0x300A, 0x300B, 0x300C, 0x300D, 0x300E, 0x300F, 0x3010, 0x3011,  # ideographic space, comma, stop, brackets
    0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026,  # dash, quotation marks, ellipsis
    0xFF01, 0xFF08, 0xFF09, 0xFF0C, 0xFF0E, 0xFF1A, 0xFF1B, 0xFF1F, 0xFF5E,  # full-width ! ( ) , . : ; ? ~
))


def in_range(ch):
    code = ord(ch)
    return any(lo <= code <= hi for lo, hi in RANGES)


def serif_text():
    with tempfile.TemporaryDirectory() as out:
        result = subprocess.run(['node', 'build.mjs', '--serif-text', '--out', out], cwd=SITE, check=True,
                                capture_output=True, text=True)
    return result.stdout


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1])
    text = serif_text()
    han = sorted({ch for ch in text if in_range(ch) and not ch.isspace()} - set(PUNCTUATION))
    if not han:
        sys.exit('the site has no Chinese headings yet (content/zh/)')
    chars = sorted(set(han) | set(PUNCTUATION))

    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.desubroutinize = True
    options.recalc_timestamp = False
    font = subset.load_font(str(source), options)
    family = font['name'].getDebugName(1) or ''
    weight = font['OS/2'].usWeightClass
    if 'Noto Serif SC' not in family or weight != 600:
        sys.exit(f'{source} is {family!r} at weight {weight}, not Noto Serif SC SemiBold (600)')
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(ch) for ch in chars])
    subsetter.subset(font)
    covered = set(font.getBestCmap())
    lacking = [ch for ch in chars if ord(ch) not in covered and ch not in PUNCTUATION]
    subset.save_font(font, str(OUT), options)
    print(f'{OUT.relative_to(SITE)}: {len(covered)} characters, {OUT.stat().st_size // 1024} KiB')
    if lacking:
        print(f'not in the source font: {"".join(lacking)}')


if __name__ == '__main__':
    main()
