"""Persistent MetaForge fetcher with Chrome TLS impersonation.

Node sends one URL per line on stdin.
This process replies with: ASCII `{status} {byte_length}\\n` then raw bytes.
"""
from __future__ import annotations

import sys

from curl_cffi import requests

session = requests.Session(impersonate="chrome")


def fetch(url: str) -> tuple[int, bytes]:
    referer = url.split("/__data.json", 1)[0]
    response = session.get(
        url,
        headers={
            "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": referer,
        },
        timeout=90,
        allow_redirects=True,
    )
    return response.status_code, response.content or b""


def write_message(status: int, body: bytes) -> None:
    sys.stdout.buffer.write(f"{status} {len(body)}\n".encode("ascii"))
    sys.stdout.buffer.write(body)
    sys.stdout.buffer.flush()


def main() -> None:
    for raw in sys.stdin:
        url = raw.strip()
        if not url or url == "QUIT":
            break
        try:
            status, body = fetch(url)
        except Exception as error:
            body = str(error).encode("utf-8")
            status = 0
        write_message(status, body)


if __name__ == "__main__":
    main()
