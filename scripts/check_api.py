import json
import time
import requests

ORIGIN = 'http://127.0.0.1:8787'
URL = ORIGIN + '/api/records'
stamp = str(int(time.time()))
A, B = 'qa-python-a-' + stamp, 'qa-python-b-' + stamp
passed = 0

def call(user=None, method='GET', records=None, headers=None):
    h = {'Connection': 'close'}
    if user:
        h.update({'oai-authenticated-user-id': user, 'oai-authenticated-user-email': user+'@example.test'})
    h.update(headers or {})
    r = requests.request(method, URL, headers=h, json={'records': records} if records is not None else None, timeout=75)
    return r.status_code, r.json()

def check(condition):
    global passed
    assert condition, f'Check {passed+1} failed'
    passed += 1
    print(f'Passed {passed}', flush=True)

base = dict(watched=True, wishlist=False, watchDate='', rating=8, notes='Test note\n<script>text only</script>')
check(call()[0] == 401)
check(call(None, 'PUT', {'1292052': base})[0] == 401)
check(call(A)[1]['records'] == {})
check(call(A, 'PUT', {'1292052': base}, {'Origin': ORIGIN})[0] == 200)
saved = call(A)[1]['records']['1292052']
check(saved['watched'] and saved['watchDate'] == '' and saved['rating'] == 8 and saved['notes'] == base['notes'])
check('1292052' not in call(B)[1]['records'])
check(call(B, 'PUT', {'1292052': dict(base, rating=4, notes='Account B')})[0] == 200)
check(call(A)[1]['records']['1292052']['rating'] == 8)
check(call(A, 'PUT', {'1292052': dict(base, watched=False)})[0] == 200)
saved = call(A)[1]['records']['1292052']
check(not saved['watched'] and saved['rating'] == 8 and saved['notes'] == base['notes'])
check(call(A, 'PUT', {'1292052': dict(base, watchDate='2026-02-30')})[0] == 400)
check(call(A, 'PUT', {'1292052': dict(base, rating=11)})[0] == 400)
check(call(A, 'PUT', {'1292052': dict(base, notes='x'*10001)})[0] == 400)
check(call(A, 'PUT', {'1292052': base}, {'Origin': 'https://foreign.example'})[0] == 403)
check(call(A, 'PUT', {'1292052': dict(base, rating=9), '1291546': dict(base, rating=-1)})[0] == 400)
check(call(A)[1]['records']['1292052']['rating'] == 8)
check(call(A, 'PUT', {'1292052': dict(base, watchDate='2025-06-08'), '1291546': dict(base, watched=False, wishlist=True)})[0] == 200)
saved = call(A)[1]['records']
check(saved['1292052']['watchDate'] == '2025-06-08' and saved['1291546']['wishlist'])
check(call(B)[1]['records']['1292052']['notes'] == 'Account B')
print(json.dumps({'passed': passed, 'accounts': [A, B], 'scope': 'Local production Worker and local D1'}))
