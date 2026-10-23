#!/usr/bin/env python3
"""由已查證的 RO-idle 裝備頁快照產生逐件保留判定。

只產生掛機用途的保留優先序；卡片投資、玩家交易價與角色條件須另判斷。
"""

from collections import Counter, defaultdict
from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "data/ro-idle裝備資料_2026-10-22.json"
OUTPUT = ROOT / "裝備/裝備逐件保留判定.md"
SOURCE_URL = "https://ro-idle.app/info/database?type=equipment&id={}"

WEAPON_ORDER = [
    "短劍", "單手劍", "雙手劍", "單手矛", "雙手矛", "單手斧", "雙手斧",
    "鈍器", "手杖", "雙手杖", "弓", "拳套", "樂器", "鞭子", "書", "拳刃",
]
ARMOR_ORDER = ["盾牌", "鎧甲", "披肩", "鞋子", "頭上", "頭中", "頭下", "飾品"]
ORDER = WEAPON_ORDER + ARMOR_ORDER

# 直接有明確、難替代的掛機用途；四洞武器一律列必留首件。
MUST_KEEP = {
    1164, 1230, 1234, 1251, 1413, 1473, 1625, 1734, 1973, 2320,
}

# 目前資料頁無卡槽或特殊效果，但有明確的職業過渡用途。
TRANSITION_KEEP = {
    1718: "獵人專用、Lv33、ATK 125；斐揚武器商人販售，可作換上配卡弓前的無卡傷害基準",
}

# 跨名稱比較：同為未加工、無獨立效果的 1 洞防具時，不因有洞就每件都囤。
# 較輕裝備在負重吃緊時仍可能有價值，故賣出須以替代品已到手為前提。
ROLE_REPLACEMENTS = {
    2302: ("可賣多餘", "已有冒險衣 [1] #2306 後不囤；同為全職業/Lv1/1洞，DEF 1→3；重量 10→30，負重吃緊時另評估"),
    2304: ("可賣多餘", "已有冒險衣 [1] #2306 後不囤；同為全職業/Lv1/1洞，DEF 2→3；重量 20→30，負重吃緊時另評估"),
    2308: ("過渡留", "全職業/Lv1/1洞、DEF 4；已有西裝外套 [1] #2320 且確認可替代後可賣，後者 DEF 5 且較輕"),
    2310: ("過渡留", "全職業/Lv1/1洞、DEF 5；已有西裝外套 [1] #2320 後不囤，後者同 DEF、重量 30 而非 120"),
    2324: ("過渡留", "服事系/Lv1/1洞、DEF 4；已有可用的西裝外套 [1] #2320 後不囤，後者全職業、DEF 5 且較輕"),
    2329: ("過渡留", "劍士/商人系/Lv1/1洞、DEF 4；已有大衣 [1] #2308 後不囤，後者全職業、同 DEF 且較輕"),
    2333: ("過渡留", "法師系/Lv1/1洞、DEF 4；已有可用的西裝外套 [1] #2320 後不囤，後者全職業、DEF 5 且較輕"),
    2340: ("過渡留", "初學者系/Lv10/1洞、DEF 4；已有西裝外套 [1] #2320 後不囤，後者全職業、Lv1、DEF 5 且較輕"),
    2402: ("可賣多餘", "已有長靴 [1] #2404 後不囤；同為全職業/Lv1/1洞，DEF 1→2；重量 20→40，負重吃緊時另評估"),
    2502: ("可賣多餘", "已有披肩 [1] #2504 後不囤；同為全職業/Lv1/1洞，DEF 1→2；重量 20→40，負重吃緊時另評估"),
    2227: ("過渡留", "同職業/Lv1/1洞、DEF 4；已有防風皮革眼鏡 [1] #2225 後不囤，後者 DEF 5、重量 30 而非 40"),
}


def field_number(summary: str, field: str) -> int:
    match = re.search(rf"{re.escape(field)}\s+([\d,]+)", summary)
    if not match:
        raise ValueError(f"缺少欄位 {field}: {summary}")
    return int(match.group(1).replace(",", ""))


def category(item: dict) -> str:
    match = re.search(r" Z (\S+?)，武器等級 \d+，攻擊力", item["summary"])
    if match:
        return match.group(1)
    part = item["part"]
    for name in ARMOR_ORDER:
        if name in part:
            return name
    raise ValueError(f"未知類型：{item['id']} {item['name']} {part}")


def effect(item: dict) -> str:
    summary = item["summary"]
    pre = summary.split(" 裝備等級 ", 1)[0]
    pre = re.sub(r"^.*?· 賣價 [\d,]+ Z ", "", pre)
    pre = re.sub(r"^\S+?，武器等級 \d+，攻擊力 \d+\s*", "", pre)
    pre = re.sub(r"^防禦力 \d+\s*", "", pre)
    pre = pre.replace("無法精煉", "").strip()
    return pre


def base_name(name: str) -> str:
    return re.sub(r" \[\d+\]$", "", name)


def short(text: str, limit: int = 85) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def determine(item: dict, variants: dict) -> tuple[str, str]:
    slot = field_number(item["summary"], "卡槽")
    own_effect = effect(item)
    higher = [
        v for v in variants[base_name(item["name"])]
        if field_number(v["summary"], "卡槽") > slot
    ]
    higher_name = max(higher, key=lambda v: field_number(v["summary"], "卡槽"))["name"] if higher else ""

    if slot == 4:
        prefix = "四洞配卡底材；先留首件"
        if own_effect:
            prefix += f"；{short(own_effect, 65)}"
        return "必留首件", prefix

    if item["id"] in MUST_KEEP:
        if own_effect:
            return "必留首件", f"特殊用途：{short(own_effect)}"
        return "必留首件", f"{slot} 洞底材；先保留首件規劃配卡"

    if item["id"] in TRANSITION_KEEP:
        return "過渡留", TRANSITION_KEEP[item["id"]]

    if item["id"] in ROLE_REPLACEMENTS:
        return ROLE_REPLACEMENTS[item["id"]]

    if higher:
        if slot == 0 and not own_effect:
            return "可賣多餘", f"同名另有 {higher_name}；確認不再作過渡或收藏後，可賣無洞複本"
        msg = f"同名另有 {higher_name}；現用或未取得高洞版時先留"
        if own_effect:
            msg += f"；{short(own_effect, 55)}"
        return "過渡留", msg

    if "目前未開放" in own_effect:
        remaining = own_effect.split("套裝（", 1)[0].strip()
        if remaining:
            return "條件留", f"個別效果：{short(remaining, 70)}；頁面註明套裝未完整開放"
        return "條件留", "頁面註明組合效果未完整開放；僅有實際用途才保留"

    if own_effect:
        label = "留" if slot else "條件留"
        return label, f"效果：{short(own_effect)}"

    if slot:
        return "留", f"{slot} 洞配卡底材；依職業、等級及目標怪保留需要的數量"

    return "可賣多餘", "本站未列卡槽或獨立戰鬥效果；確認無過渡、外觀收藏及交易需求後可賣"


def main() -> None:
    items = json.loads(SNAPSHOT.read_text())
    if len(items) != 458 or len({item["id"] for item in items}) != len(items):
        raise ValueError("快照筆數或 ID 不符合 2026-10-22 查證結果")

    variants = defaultdict(list)
    for item in items:
        variants[base_name(item["name"])].append(item)

    classified = []
    for item in items:
        status, reason = determine(item, variants)
        classified.append((item, category(item), status, reason))

    counts = Counter(status for _, _, status, _ in classified)
    by_type = defaultdict(list)
    for row in classified:
        by_type[row[1]].append(row)

    out = [
        "# RO 放置仙境：458 件裝備逐件保留判定",
        "",
        "**最後查證：2026-10-22**。來源為 [RO-idle 裝備資料庫](https://ro-idle.app/info/database?type=equipment)及每列直達頁；本檔由同日逐件查證的資料快照產生。",
        "",
        "**用途：**為掛機撿裝設定提供保守的初步分類，涵蓋本站目前 458 件裝備。判定以**未插卡、未精煉的新掉落**為前提；已投入卡片或精煉的裝備須單獨評估。玩家市場價格、卡片轉移成本與角色目標未知，因此「可賣多餘」均附條件，不能直接當成無條件自動販售清單。",
        "",
        f"**分類數：**必留首件 {counts['必留首件']}、留 {counts['留']}、過渡留 {counts['過渡留']}、條件留 {counts['條件留']}、可賣多餘 {counts['可賣多餘']}。",
        "",
        "- **必留首件**：先保留至少一件，再決定配卡或流派；不是全部複本都必留。",
        "- **留**：有明確洞數或效果，依角色與目標保留。",
        "- **過渡留**：有同名更高洞數或同用途更實用版本；取得且驗證替代後再處理舊版。",
        "- **條件留**：特殊效果、套裝或收藏用途依場景確認。",
        "- **可賣多餘**：已無過渡、配卡、外觀收藏或交易用途的多餘複本才賣。",
        "",
        "**判斷優先序：**先核對 ID／洞數與職業限制，再看效果與來源，並比較同用途裝備的 DEF、重量及可取得性，最後比較同怪的擊殺、補品和存活。單純有洞不等於要囤每一種。低 ATK 四洞武器不保證比高 ATK 少洞武器有效。資訊站標示的基準買價不代表商店有賣；基準掉率不代表角色實得掉率。具體配裝請參考[實用裝備分析](各類型裝備保留與賣出清單.md)。",
    ]

    for kind in ORDER:
        rows = by_type[kind]
        out += ["", f"## {kind}（{len(rows)} 件）", "", "| 裝備／ID | 洞 | 判定 | 用途或處理條件 | 頁面首列來源 |", "| --- | ---: | --- | --- | --- |"]
        for item, _, status, reason in rows:
            slot = field_number(item["summary"], "卡槽")
            source = item["sources"][0]["name"] if item["sources"] else "資訊站未列"
            name = item["name"].replace("[", "\\[").replace("]", "\\]")
            link = f"[{name} #{item['id']}]({SOURCE_URL.format(item['id'])})"
            out.append(f"| {link} | {slot} | **{status}** | {reason} | {source} |")

    out += [
        "",
        "## 本站未收錄的 R 版前候選",
        "",
        "| 候選 | 目前判定 | 依據與待確認 |",
        "| --- | --- | --- |",
        "| [露娜弓 [2]／Luna Bow #1723](https://ratemyserver.net/index.php?item_id=1723&page=item_db) | **R 版前參考／待此遊戲驗證：若遊戲內實際取得，先留首件** | [本站裝備搜尋](https://ro-idle.app/info/database?type=equipment&q=%E9%9C%B2%E5%A8%9C%E5%BC%93)目前 0 筆；舊版資料的卡槽、精煉 DEF 與瘋兔別針組合不可直接當成本遊戲效果。需遊戲內物品說明、ID、取得來源及配裝實測。此列**不計入上方 458 件**。 |",
        "",
        "## 待角色資料才能決定的事項",
        "",
        "- 未提供職業／等級／流派、持有卡片、掛機地圖、實際掉落量與倉庫剩餘格數，無法指定每件要留幾個或計算 Zeny 淨收益。",
        "- 多部位頭飾歸到表中第一個對應類型；完整部位與職業限制以各裝備直達頁為準。",
        "- 「頁面首列來源」僅為查找線索，可能是怪物、商店、製作城鎮或箱子；請點入裝備頁確認取得方式。",
        "- 若資料庫更新，須重新逐筆查證並更新快照；不能把本表數值當作永久現況。",
        "",
    ]
    OUTPUT.write_text("\n".join(out))
    print(f"產生 {OUTPUT.name}：{len(classified)} 件；{dict(counts)}")


if __name__ == "__main__":
    main()
