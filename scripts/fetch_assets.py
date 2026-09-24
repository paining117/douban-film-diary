from __future__ import annotations
import concurrent.futures
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import re
import threading
import time

import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parent
POSTERS = ROOT / 'posters'
PAGES = ROOT / 'source-pages'
POSTERS.mkdir(exist_ok=True)
PAGES.mkdir(exist_ok=True)
BASE = 'https://movie.douban.com/top250'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', 'Referer': BASE}
fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
if (ROOT / 'movies.json').exists():
    fetched_at = json.loads((ROOT / 'movies.json').read_text(encoding='utf-8'))['fetchedAt']
movies = []
pages = []
session = requests.Session()
session.headers.update(HEADERS)

def save_json(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

for start in range(0, 250, 25):
    url = BASE if start == 0 else f'{BASE}?start={start}&filter='
    raw_path = PAGES / f'top250-{start:03}.html'
    if raw_path.exists():
        html = raw_path.read_text(encoding='utf-8')
        response_url = url
        raw_bytes = html.encode('utf-8')
    else:
        response = session.get(url, timeout=30)
        response.raise_for_status()
        response.encoding = 'utf-8'
        html = response.text
        response_url = response.url
        raw_bytes = response.content
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select('ol.grid_view > li')
    if len(cards) != 25:
        raise RuntimeError(f'Access/content limitation: {url}: expected 25 cards, got {len(cards)}. No retries attempted.')
    raw_path.write_text(html, encoding='utf-8')
    pages.append({'url': response_url, 'path': str(raw_path.relative_to(ROOT)).replace('\\', '/'), 'sha256': hashlib.sha256(raw_bytes).hexdigest(), 'count': len(cards)})
    for card in cards:
        link = card.select_one('.hd a')['href']
        subject_id = re.search(r'/subject/(\d+)/', link).group(1)
        title_spans = card.select('.hd .title')
        title = title_spans[0].get_text(strip=True)
        other_titles = [node.get_text(' ', strip=True).lstrip('/').strip() for node in title_spans[1:] + card.select('.hd .other')]
        bd = card.select_one('.bd')
        intro = bd.find('p')
        metadata_lines = [' '.join(line.split()) for line in intro.get_text('\n', strip=True).splitlines() if line.strip()]
        summary = '\n'.join(metadata_lines)
        year_region_genres = metadata_lines[-1].split(' / ') if metadata_lines else []
        rating_count_match = re.search(r'([\d,]+)人评价', card.select_one('.rating_num').parent.get_text(' ', strip=True))
        quote = card.select_one('.quote span')
        img = card.select_one('.pic img')
        movies.append({
            'rank': int(card.select_one('.pic em').get_text(strip=True)),
            'id': subject_id,
            'title': title,
            'originalTitle': title_spans[1].get_text(' ', strip=True).lstrip('/').strip() if len(title_spans) > 1 else title,
            'otherTitles': other_titles,
            'metadata': summary,
            'metadataLines': metadata_lines,
            'credits': '\n'.join(metadata_lines[:-1]),
            'year': year_region_genres[0].strip() if year_region_genres else '',
            'regions': year_region_genres[1].split() if len(year_region_genres) > 1 else [],
            'countries': year_region_genres[1].strip() if len(year_region_genres) > 1 else '',
            'genres': year_region_genres[2].split() if len(year_region_genres) > 2 else [],
            'rating': float(card.select_one('.rating_num').get_text(strip=True)),
            'ratingCount': int(rating_count_match.group(1).replace(',', '')) if rating_count_match else None,
            'quote': quote.get_text(strip=True) if quote else '',
            'posterUrl': img['src'],
            'posterPath': f'posters/{subject_id}.jpg',
            'poster': f'/posters/{subject_id}.jpg',
            'posterAvailable': False,
            'doubanUrl': link,
            'url': link,
            'sourcePage': response_url,
        })
    print(f'LIST {start + 1}-{start + 25}: {len(movies)} total', flush=True)
    save_json('movies.json', {'source': BASE, 'fetchedAt': fetched_at, 'movies': movies})
    time.sleep(1.2)

assert len(movies) == 250
assert [m['rank'] for m in movies] == list(range(1, 251))
assert len({m['id'] for m in movies}) == 250
save_json('source-pages.json', pages)
thread_local = threading.local()
access_blocked = threading.Event()

def download(movie):
    result = {'id': movie['id'], 'url': movie['posterUrl'], 'path': movie['posterPath']}
    if access_blocked.is_set():
        return {**result, 'ok': False, 'error': 'Not requested after source returned an access restriction.'}
    try:
        if not hasattr(thread_local, 'session'):
            thread_local.session = requests.Session()
            thread_local.session.headers.update(HEADERS)
        r = thread_local.session.get(movie['posterUrl'], timeout=30)
        if r.status_code in (401, 403, 418, 429):
            access_blocked.set()
        r.raise_for_status()
        with Image.open(io.BytesIO(r.content)) as img:
            img.verify()
        with Image.open(io.BytesIO(r.content)) as img:
            result.update({'width': img.width, 'height': img.height, 'format': img.format})
            img.load()
            if img.format != 'JPEG':
                raise ValueError(f"Expected JPEG; received {img.format}")
        (ROOT / movie['posterPath']).write_bytes(r.content)
        result.update({'ok': True, 'bytes': len(r.content), 'sha256': hashlib.sha256(r.content).hexdigest()})
    except Exception as exc:
        result.update({'ok': False, 'error': str(exc)})
    return result

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for index, result in enumerate(pool.map(download, movies), 1):
        results.append(result)
        if index % 25 == 0:
            print(f"POSTERS {index}/250; valid={sum(r['ok'] for r in results)}", flush=True)
        if index % 25 == 0:
            save_json('poster-validation.json', results)
save_json('poster-validation.json', results)
failed = [r for r in results if not r['ok']]
available_ids = {r['id'] for r in results if r['ok']}
for movie in movies:
    movie['posterAvailable'] = movie['id'] in available_ids
save_json('movies.json', {'source': BASE, 'fetchedAt': fetched_at, 'movies': movies})
report = {'fetchedAt': fetched_at, 'movieCount': len(movies), 'uniqueIds': len({m['id'] for m in movies}), 'rankSequenceValid': [m['rank'] for m in movies] == list(range(1, 251)), 'validPosterCount': len(results) - len(failed), 'failedPosters': failed, 'pages': pages}
save_json('validation.json', report)
print(json.dumps({k: v for k, v in report.items() if k not in ('pages', 'failedPosters')}, ensure_ascii=False), flush=True)
