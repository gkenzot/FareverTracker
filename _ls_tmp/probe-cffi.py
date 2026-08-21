from curl_cffi import requests

url = "https://metaforge.app/farever/database/mounts/page/1/__data.json"
headers = {
    "Accept": "application/json",
    "Referer": "https://metaforge.app/farever/database/mounts",
}
r = requests.get(url, headers=headers, impersonate="chrome", timeout=30)
print("status", r.status_code, "ctype", r.headers.get("content-type"), "len", len(r.content))
print(r.text[:80].replace("\n", " "))
