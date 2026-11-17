"""Minimal WaveSpeed client for generating the game art. Key from $WAVESPEED_API_KEY (never committed).

  python3 tools/art/ws.py <model> <out.png> --set prompt="..." [--set k=v ...] [--image file.png] [--images a.png b.png]

Prints the balance before and after, so every asset's real cost is logged to art/costs.jsonl.
"""
import json, os, sys, time, urllib.request, mimetypes, uuid
from pathlib import Path

API = "https://api.wavespeed.ai/api/v3"
KEY = os.environ["WAVESPEED_API_KEY"]


def req(method, url, body=None, headers=None):
    h = {"Authorization": f"Bearer {KEY}"}
    h.update(headers or {})
    data = None
    if body is not None and not isinstance(body, (bytes, bytearray)):
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    elif body is not None:
        data = body
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read())


def balance():
    return req("GET", f"{API}/balance")["data"]["balance"]


def upload(path):
    boundary = uuid.uuid4().hex
    p = Path(path)
    ctype = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{p.name}\"\r\nContent-Type: {ctype}\r\n\r\n").encode() + p.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    res = req("POST", f"{API}/media/upload/binary", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    return res["data"]["download_url"]


def main():
    model, out = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    payload = {}
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--set":
            k, v = args[i + 1].split("=", 1)
            payload[k] = json.loads(v) if v[:1] in "[{" or v in ("true", "false") else v
            i += 2
        elif a == "--image":
            payload["image"] = upload(args[i + 1]); i += 2
        elif a == "--images":
            j = i + 1; urls = []
            while j < len(args) and not args[j].startswith("--"):
                urls.append(upload(args[j])); j += 1
            payload["images"] = urls; i = j
        else:
            raise SystemExit(f"unknown arg {a}")
    b0 = balance()
    sub = req("POST", f"{API}/{model}", payload)
    rid = sub["data"]["id"]
    t0 = time.time()
    while True:
        time.sleep(2)
        res = req("GET", f"{API}/predictions/{rid}/result")["data"]
        if res["status"] in ("completed", "failed"):
            break
        if time.time() - t0 > 600:
            raise SystemExit("timeout")
    if res["status"] != "completed":
        raise SystemExit(f"failed: {res.get('error')}")
    url = res["outputs"][0]
    with urllib.request.urlopen(url, timeout=120) as r, open(out, "wb") as f:
        f.write(r.read())
    b1 = balance()
    cost = round(b0 - b1, 4)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    with open(Path(__file__).resolve().parents[2] / "art" / "costs.jsonl", "a") as f:
        f.write(json.dumps({"file": str(out), "model": model, "cost": cost, "secs": round(time.time() - t0)}) + "\n")
    print(f"{out}  cost ${cost}  balance ${b1:.3f}  {round(time.time() - t0)}s")


if __name__ == "__main__":
    main()
