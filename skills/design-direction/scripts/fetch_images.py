#!/usr/bin/env python3
"""
從 Wikimedia Commons 抓真實圖片（公共領域／CC），供 `design-direction` 三方向流程取真圖用。

為什麼有這個腳本：內容型設計（鸚鵡／咖啡／某個地方…）必須用真圖，不能用 CSS 色塊糊弄。
每次讓模型現寫抓圖邏輯既慢又容易漏坑（忘了合規 UA → 429）。這裡固化好，下次只改關鍵字。

用法：
  python3 fetch_images.py --query "Petronas Towers" "Langkawi beach" \
      --out docs/work/<branch>/design-demos/img --count 2 --width 1600

每個 query 取前 count 張、縮放到 width、下載到 out，並印出清單
（路徑 | 授權 | 作者 | 來源頁）便於誠實性核對。
全部抓不到 → 退出碼 1，提示走 SKILL.md §圖片是不是必需 的三級兜底。

已知限制：**對 Wikimedia 沒有任何 rate limit 處理**——無 retry、無 backoff、
無 429 判讀、無請求間隔。--query 給 N 個關鍵字 × --count 張 = N + N×count 次連發請求。
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request

# 某些網路環境下 proxy 會讓 TLS 握手失敗；需要時用這個開關清掉。
# 預設不清：企業網路下無條件清 proxy 會 100% 連不上，而且失敗訊息看不出根因。
if os.environ.get("BSTACK_FETCH_CLEAR_PROXY") == "1":
    for _k in ("ALL_PROXY", "all_proxy", "HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy"):
        os.environ.pop(_k, None)

API = "https://commons.wikimedia.org/w/api.php"
# 合規 User-Agent 是 Wikimedia 的硬性要求，否則回 429。
# 這是實際送往 Wikimedia 的 header，用來識別本專案；同步上游時不要改回去。
UA = "bstack-design-image-fetcher/1.0 (+https://github.com/fujiei22/bstack)"


def _api_get(params):
    """對 Commons API 發一次 GET，回傳解析後的 JSON。"""
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def _safe(name):
    """把任意字串轉成可當檔名的安全形式（非字母數字一律換成底線，截斷 60 字元）。"""
    return re.sub(r"[^\w\-.]", "_", name)[:60]


def fetch(query, out, count, width):
    """搜一個關鍵字並下載前 count 張，回傳實際落地的路徑清單。抓不到回空 list，不丟例外。"""
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": query, "gsrnamespace": 6, "gsrlimit": count,
        "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": width,
    }
    try:
        data = _api_get(params)
    except Exception as e:
        print(f"[FAIL search] {query}: {e}", file=sys.stderr)
        return []
    pages = (data.get("query", {}) or {}).get("pages", {})
    got = []
    for p in list(pages.values())[:count]:
        ii = (p.get("imageinfo") or [{}])[0]
        thumb = ii.get("thumburl") or ii.get("url")
        if not thumb:
            continue
        meta = ii.get("extmetadata", {}) or {}
        lic = (meta.get("LicenseShortName", {}) or {}).get("value", "?")
        artist = re.sub("<[^>]+>", "", (meta.get("Artist", {}) or {}).get("value", "?")).strip()
        ext = os.path.splitext(thumb)[1].split("?")[0] or ".jpg"
        fn = _safe(query) + "_" + _safe(p.get("title", "img").replace("File:", ""))
        fn = os.path.splitext(fn)[0][:55] + ext
        path = os.path.join(out, fn)
        try:
            req = urllib.request.Request(thumb, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
                f.write(r.read())
            got.append(path)
            print(f"[OK] {path}  | {lic} | {artist} | {ii.get('descriptionurl','')}")
        except Exception as e:
            print(f"[FAIL dl] {thumb}: {e}", file=sys.stderr)
    if not got:
        print(f"[EMPTY] 「{query}」沒抓到——換關鍵字，或走三級兜底", file=sys.stderr)
    return got


def main():
    """CLI 進入點：逐個關鍵字抓圖，全部失敗時以退出碼 1 結束。"""
    ap = argparse.ArgumentParser(
        description="Wikimedia Commons 真圖抓取（design-direction 三方向取圖）")
    ap.add_argument("--query", nargs="+", required=True, help="一個或多個英文關鍵字（英文命中率高）")
    ap.add_argument("--out", required=True,
                    help="輸出目錄（建議 docs/work/<branch>/design-demos/img）")
    ap.add_argument("--count", type=int, default=2, help="每個關鍵字抓幾張（預設 2）")
    ap.add_argument("--width", type=int, default=1600, help="縮放寬度 px（預設 1600）")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    allgot = []
    for q in a.query:
        allgot += fetch(q, a.out, a.count, a.width)
    print(f"\n=== 共下載 {len(allgot)} 張到 {a.out} ===")
    print("誠實性核對：去掉每張圖，資訊是否有損？授權是否允許這個用途？不合適的刪掉。")
    if not allgot:
        print("全部失敗 → 走 SKILL.md §圖片是不是必需 的三級兜底（換來源 → 誠實 placeholder → 繼續不卡流程）",
              file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
