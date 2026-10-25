#!/usr/bin/env python3
"""由最新技能快照產生各職業技能索引；放置版重點由人工核對後維護。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = sorted((ROOT / 'data').glob('ro-idle技能樹資料_*.json'))[-1]
DATA = json.loads(SNAPSHOT.read_text())
JOBS = {j['id']: j for j in DATA['jobs']}
SKILLS = DATA['skills']
KIND = {'passive': '被動', 'self': '自身／增益', 'attack': '攻擊', 'ground': '地面', 'support': '支援'}

# 只摘錄會改變放置操作或與原版直覺不同的規則；詳細各級數值以資訊站直達頁為準。
NOTES = {
    'MG_SIGHT': '掛機只在附近有隱身怪物時施放。',
    'AL_RUWACH': '掛機只在附近有隱身怪物時施放。',
    'AL_WARP': '本遊戲以地圖選擇／蝴蝶翅膀移動，技能停用。',
    'AL_PNEUMA': '傳送之陣停用，前置無法達成；目前不可學。',
    'AL_BLESSING': '遇到詛咒或石化時優先解除，該次不提供屬性增益。',
    'AC_MAKINGARROW': '可設掛機輔助規則，在箭矢耗盡時用指定材料製箭並裝備；受負重限制。',
    'MC_DISCOUNT': '折扣包含 NPC 自動購買。',
    'MC_CHANGECART': '手推車外觀在本遊戲不顯示，技能停用。',
    'SM_AUTOBERSERK': '低血量自動觸發，會提高輸出並降低防禦；掛機須注意存活率。',
    'CR_DEVOTION': '只保護同圖一起掛機且符合等級差限制的隊友。',
    'WZ_ESTIMATION': '怪物資料已在地圖資訊顯示，技能停用。',
    'SA_CASTCANCEL': '掛機不會主動取消詠唱；可學作前置。',
    'SA_MAGICROD': '設為輔助規則後，可在怪物魔法命中前自動施放。',
    'SA_SPELLBREAKER': '掛機只對正在詠唱的目標施放。',
    'SA_FREECAST': '改為詠唱受傷時有機率不被打斷；原版的移動效果不適用。',
    'SA_AUTOSPELL': '普攻觸發的魔法由掛機規則選擇；未指定時依資訊站規則選技能。',
    'SA_VOLCANO': '領域改為同圖一起掛機隊友的增益，四種領域同時僅能保留一種。',
    'SA_DELUGE': '領域改為同圖一起掛機隊友的增益，四種領域同時僅能保留一種。',
    'SA_VIOLENTGALE': '領域改為同圖一起掛機隊友的增益，四種領域同時僅能保留一種。',
    'SA_LANDPROTECTOR': '同圖隊友免受怪物地面魔法，期間也不能使用自己的地面技能。',
    'SA_DISPELL': '掛機有目標條件；可能連自己施加的異常狀態也解除。',
    'SA_ABRACADABRA': '從本遊戲已實作技能抽取，結果具不確定性。',
    'HT_SHOCKWAVE': '怪物沒有 SP，此技能只作前置。',
    'HT_TALKIEBOX': '沒有地面留言用途，技能停用。',
    'HT_SPRINGTRAP': '沒有其他玩家的陷阱要拆，技能停用。',
    'HT_BLITZBEAT': '獵鷹可由弓普攻自動觸發；觸發率須按本遊戲公式與 LUK 評估。',
    'BA_FROSTJOKER': '立即生效；同圖隊友也可能被冰凍，演奏中不能使用。',
    'DC_SCREAM': '立即生效；同圖隊友也可能被暈眩，演奏中不能使用。',
    'DC_UGLYDANCE': '怪物沒有 SP，可學但不施放，只作前置。',
    'DC_DONTFORGETME': '對怪物只降低移動速度，不降低攻速。',
    'BD_ADAPTATION': '只在目前演奏無效時才可能依掛機規則結束演奏。',
    'BD_ENCORE': '依掛機規則重唱上一首有效歌舞，減少 SP 消耗。',
    'PR_BENEDICTIO': '需要兩位同圖一起掛機的服事系隊友。',
    'MO_TRIPLEATTACK': '普攻機率改為三連擊，可銜接連段。',
    'MO_BODYRELOCATION': '沒有地面位置，技能可學但不施放。',
    'MO_BLADESTOP': '只在怪物即將近身攻擊時依掛機規則施放。',
    'BS_ADRENALINE': '全隊攻速增益有斧／鈍器限制，須核對隊友武器。',
    'AM_DEMONSTRATION': '設輔助規則後，在身邊有怪物時放置持續火焰；換圖會消失。',
    'AM_ACIDTERROR': '傷害與原版直覺不同；耗鹽酸瓶，需核對本遊戲數值。',
    'AM_POTIONPITCHER': '掛機規則以 HP 百分比判定補血門檻。',
    'AM_CANNIBALIZE': '植物擊殺的怪物無經驗；用於掉落時仍須計入消耗品。',
    'AM_SPHEREMINE': '召喚後依戰鬥條件自爆；消耗刺錘瓶。',
    'AM_BIOETHICS': '轉職後可直接學的任務技能，不花技能點。',
    'AM_CALLHOMUN': '可設為輔助規則，在生命體安息時召喚。',
    'AM_RESURRECTHOMUN': '可設為輔助規則，在生命體死亡時復活。',
    'AS_POISONREACT': '受攻擊時自動反擊；須依怪物屬性與近身條件評估。',
    'RG_SNATCHER': '非弓普攻命中才可能自動偷竊；每隻怪最多成功一次。',
    'RG_BACKSTAP': '本遊戲無方向判定，符合其他條件即可使用。',
    'RG_TUNNELDRIVE': '本遊戲沒有移動，只作潛擊前置。',
    'RG_GRAFFITI': '可學但不會施放。',
    'RG_FLAGGRAFFITI': '可學但不會施放。',
    'RG_CLEANER': '沒有可清除的地面圖案，可學但不會施放。',
    'RG_GANGSTER': '需同圖一起掛機、至少兩名已學技能的流氓坐下。',
    'RG_COMPULSION': 'NPC 自動購買也適用；與商人折扣取較大值。',
    'RG_PLAGIARISM': '可在城鎮停掛時抄同隊隊友技能，也可被怪物技能命中後學會；新技能會覆蓋舊技能，可在職業頁鎖定。',
}

for sid in ['SA_FLAMELAUNCHER', 'SA_FROSTWEAPON', 'SA_LIGHTNINGLOADER', 'SA_SEISMICWEAPON']:
    NOTES[sid] = '屬性附加會取代其他武器附魔；施放失敗可能卸下武器，須計入材料與續掛風險。'
for sid in ['BA_WHISTLE', 'BA_ASSASSINCROSS', 'BA_POEMBRAGI', 'BA_APPLEIDUN',
            'DC_HUMMING', 'DC_FORTUNEKISS', 'DC_SERVICEFORYOU']:
    NOTES[sid] = '歌舞只惠及同圖一起掛機的隊友；演奏者自己無效果，持續消耗 SP。'
for sid in ['BD_LULLABY', 'BD_RICHMANKIM', 'BD_ETERNALCHAOS', 'BD_DRUMBATTLEFIELD',
            'BD_RINGNIBELUNGEN', 'BD_ROKISWEIL', 'BD_INTOABYSS', 'BD_SIEGFRIED']:
    NOTES[sid] = '合奏需同隊、同圖掛機且雙方都學會；兩人持續耗 SP，任一方停止即結束。'
NOTES['BD_RICHMANKIM'] = '兩位演奏者自己也享有經驗加成；同圖一起掛機的隊友同樣有效，Lv 5 為 +150%。'

def link(sid):
    return f"[{SKILLS[sid]['name']}（{sid}）](https://ro-idle.app/info/database?type=skills&id={sid})"

def rows(ids, tree):
    result = ['| 技能（ID） | 最高 Lv | 類型 | 前置／任務條件 | 放置版重點 |',
              '| --- | ---: | --- | --- | --- |']
    for sid in ids:
        node = tree[sid]
        skill = SKILLS[sid]
        req = '、'.join(f"{SKILLS[r]['name']} Lv {lv}" for r, lv in node.get('requires', {}).items()) or '無'
        if node.get('questJobLv'):
            req += f"；任務 Job {node['questJobLv']}，不扣點"
        note = NOTES.get(sid, '各級效果與消耗請見技能直達頁。')
        if skill['status']['kind'] != 'ready' and sid not in NOTES:
            note = f"資訊站標示「{skill['status']['kind']}」；{skill['status'].get('reason', '暫不可用')}"
        result.append(f"| {link(sid)} | {node['maxLv']} | {KIND.get(skill['kind'], skill['kind'])} | {req} | {note} |")
    return '\n'.join(result)

OUT = ROOT / '技能'
OUT.mkdir(exist_ok=True)
for job in DATA['jobs']:
    tree = {n['id']: n for n in job['skillTree']}
    parent = JOBS.get((job.get('jobChange') or {}).get('from'))
    parent_ids = set(n['id'] for n in parent['skillTree']) if parent else set()
    own = [sid for sid in tree if sid not in parent_ids]
    if job['id'] == 'supernovice':
        own = [sid for sid in own if sid not in ('NV_BASIC', 'NV_FIRSTAID')]
    lines = [f"# RO 放置仙境：{job['name']}技能說明", '', f"**最後查證：{DATA['queried']}**", '',
             f"依[資訊站技能資料庫](https://ro-idle.app/info/database?type=skills)與[{job['name']}職業頁](https://ro-idle.app/info/database?type=jobs&id={job['id']})整理。表中最高等級、前置與可用狀態屬已查證資料；「放置版重點」是依技能描述整理的操作摘要，不代表傷害或收益實測。各級數值、SP、詠唱、冷卻、武器與材料限制請點技能名稱核對。", '']
    if parent:
        lines += [f"本職業由{parent['name']}轉職；繼承的一轉技能請見[{parent['name']}技能說明]({parent['name']}技能說明.md)。", '']
    if job['id'] == 'supernovice':
        lines += ['基本技能與緊急治療見[初學者技能說明](初學者技能說明.md)。超級初心者的下表列出其餘可學技能，實際點數與轉職條件以職業頁為準。', '']
    lines += ['## 技能清單', '', rows(own, tree), '',
              '## 放置版配點提醒', '',
              '- 表中「停用」、「無法學習」與「可學但不施放」不同：前兩者不可當作可用技能；後者若是前置，仍可能需要投入點數。',
              '- 自動觸發、輔助規則、同圖隊友、持續扣 SP 與材料消耗會改變掛機效益；請以角色實測確認循環與續掛能力。',
              '- 尚無角色資料、技能循環與實測，故此索引不指定通用最終配點或精確收益。', '']
    if job['id'] == 'alchemist':
        homun = [sid for sid in SKILLS if sid.startswith(('HAMI_', 'HFLI_', 'HLIF_', 'HVAN_'))]
        lines += ['## 生命體技能（未列於鍊金術師技能樹）', '',
                  '以下技能出現在技能資料庫，但非鍊金術師可直接投入 Job 點數的技能；生命體取得、成長與施放條件須另核對。', '',
                  '| 技能（ID） | 最高 Lv | 類型 |', '| --- | ---: | --- |']
        lines += [f"| {link(sid)} | {SKILLS[sid]['maxLv']} | {KIND.get(SKILLS[sid]['kind'], SKILLS[sid]['kind'])} |" for sid in homun]
        lines += ['']
    (OUT / f"{job['name']}技能說明.md").write_text('\n'.join(lines))

tree_ids = {node['id'] for job in DATA['jobs'] for node in job['skillTree']}
homun_ids = {sid for sid in SKILLS if sid.startswith(('HAMI_', 'HFLI_', 'HLIF_', 'HVAN_'))}
other_ids = set(SKILLS) - tree_ids - homun_ids
other_lines = ['# RO 放置仙境：資料庫其他技能', '', f"**最後查證：{DATA['queried']}**", '',
               '以下技能見於[資訊站技能資料庫](https://ro-idle.app/info/database?type=skills)，但沒有列入任何玩家職業技能樹，也不是上表的生命體技能。不能據此認定玩家可以投入 Job 點數學習。', '',
               '| 技能（ID） | 最高 Lv | 類型 |', '| --- | ---: | --- |']
other_lines += [f"| {link(sid)} | {SKILLS[sid]['maxLv']} | {KIND.get(SKILLS[sid]['kind'], SKILLS[sid]['kind'])} |" for sid in sorted(other_ids)]
(OUT / '資料庫其他技能.md').write_text('\n'.join(other_lines) + '\n')
(ROOT / 'data' / f"ro-idle技能重點_{DATA['queried']}.json").write_text(
    json.dumps({'queried': DATA['queried'], 'source': DATA['source'], 'notes': NOTES}, ensure_ascii=False, indent=2) + '\n')
print(f"產生 {len(DATA['jobs'])} 份職業技能說明與 1 份其他技能說明，來源 {SNAPSHOT.name}")
