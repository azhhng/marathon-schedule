"""Version browser assets and refresh the optional legacy local preview mirror."""
from pathlib import Path
import hashlib
import re
import shutil

root = Path(__file__).resolve().parents[1]
docs = root / 'docs'
index = docs / 'index.html'
html = index.read_text()
for name, attr in [('style.css', 'href'), ('fueling.js', 'src'), ('app.js', 'src')]:
    digest = hashlib.sha256((docs / name).read_bytes()).hexdigest()[:12]
    pattern = rf'{attr}="{re.escape(name)}(?:\?v=[^"]*)?"'
    html, count = re.subn(pattern, f'{attr}="{name}?v={digest}"', html)
    if count != 1:
        raise SystemExit(f'Expected one asset reference for {name}, found {count}')
index.write_text(html)
mirror = root / 'toronto-2027' / 'dist'
if mirror.is_dir():
    for name in ['index.html', 'style.css', 'app.js', 'fueling.js']:
        shutil.copy2(docs / name, mirror / name)
    (mirror.parent / 'README.md').write_text(
        '# Local preview mirror\n\n'
        'The canonical website is in the parent repository’s `docs/` folder. '
        'See the parent `README.md` and `PROGRAM_REVIEW.md` for the current training plan.\n\n'
        'Run `python3 scripts/prepare-site.py` from the parent repository to update '
        'this mirror and all browser asset versions. Serve `docs/` for local preview.\n'
    )
print('Browser assets versioned; available local mirror synchronized.')
