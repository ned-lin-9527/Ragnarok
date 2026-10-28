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
    'AL_WARP': '可學但不施放（本遊戲以地圖選擇／蝴蝶翅膀移動）；要學光之障壁，須先點此技能 Lv 4 作過路點。',
    'AL_PNEUMA': '10 秒內擋下自己或隊友受到的遠程物理攻擊（弓箭、遠距離普攻與物理技能），不擋魔法與近身；前置傳送之陣 Lv 4 本身不施放。',
    'AL_BLESSING': '遇到詛咒或石化時優先解除，該次不提供屬性增益。',
    'AC_MAKINGARROW': '可設掛機輔助規則，在箭矢耗盡時用指定材料製箭並裝備；受負重限制。',
    'MC_DISCOUNT': '折扣包含 NPC 自動購買。',
    'MC_CHANGECART': '任務技能，不扣點；只在角色頁「形象」更換手推車外觀（第 2～5 型需 Base 41／66／81／91），不影響掛機。',
    'SM_AUTOBERSERK': '低血量自動觸發，會提高輸出並降低防禦；掛機須注意存活率。',
    'CR_DEVOTION': '只保護同圖一起掛機且符合等級差限制的隊友。',
    'WZ_ESTIMATION': '可學但不施放；怪物的等級、HP、屬性、種族與體型已在地圖資訊顯示，也沒有後續技能需要它作前置。',
    'SA_CASTCANCEL': '可學，但掛機不會主動取消詠唱；若要學自由施法，須先點此技能 Lv 1 作過路點。',
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
    'HT_SHOCKWAVE': '可學，但怪物沒有 SP，放置時無實際效果；若要學爆散陷阱，須先點此技能 Lv 1 作過路點。',
    'HT_REMOVETRAP': '可學，但陷阱觸發或換圖即消失，放置時不需回收；後續只通往同樣不施放的陷阱探查、爆破陷阱，通常不必為過路而投入。',
    'HT_TALKIEBOX': '可學但不施放（沒有在地面留言給其他玩家的用途）；沒有後續技能需要它作前置。',
    'HT_SPRINGTRAP': '可學但不施放（沒有其他人設置的陷阱要拆）；沒有後續技能需要它作前置。',
    'HT_BLITZBEAT': '獵鷹可由弓普攻自動觸發；觸發率須按本遊戲公式與 LUK 評估。',
    'BA_FROSTJOKER': '立即生效；同圖隊友也可能被冰凍，演奏中不能使用。',
    'DC_SCREAM': '立即生效；同圖隊友也可能被暈眩，演奏中不能使用。',
    'DC_UGLYDANCE': '可學，但怪物沒有 SP，掛機不施放；若要學哼唱之音、勿忘我、女神之吻或為您服務，須先點此技能 Lv 3 作過路點。',
    'DC_DONTFORGETME': '對怪物只降低移動速度，不降低攻速。',
    'BD_ADAPTATION': '掛機可設「演奏已超過 N 秒」主動結束目前演奏；單人歌舞結束後隊友效果再留 20 秒。輪唱時搭配各曲「隊友身上沒有」。',
    'BD_ENCORE': '重唱上一首有效歌舞可降低起始 SP；多首歌舞輪唱時不要無條件啟用，以免重唱前曲而打亂順序。',
    'PR_BENEDICTIO': '需要兩位同圖一起掛機的服事系隊友。',
    'MO_TRIPLEATTACK': '普攻機率改為三連擊，可銜接連段。',
    'MO_BODYRELOCATION': '沒有地面位置，技能可學但不施放；沒有後續技能需要它作前置。',
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
    'RG_TUNNELDRIVE': '可學，但本遊戲沒有移動效果；若要學潛擊，須先點此技能 Lv 2 作過路點。',
    'RG_GRAFFITI': '可學但放置時不施放；沒有後續技能需要它作前置。',
    'RG_FLAGGRAFFITI': '可學但放置時不施放；後續塗鴉同樣不施放，不是有效輸出的必需過路點。',
    'RG_CLEANER': '沒有可清除的地面圖案，可學但不施放；後續旗幟塗鴉與塗鴉也不施放。',
    'HLIF_AVOID': '生命體可學但放置時不施放；是腦手術的前置。生命體點數與玩家 Job 點數分開。',
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
NOTES['BD_RICHMANKIM'] += ' 技能文字未明載合奏中斷後的效果留存；20 秒輪唱能否保持經驗 BUFF 須實測。'
NOTES['BA_POEMBRAGI'] += ' 結束後隊友效果保留 20 秒；可用「隊友身上沒有」作輪唱條件。'
NOTES['DC_SERVICEFORYOU'] += ' 結束後隊友效果保留 20 秒；可用「隊友身上沒有」作輪唱條件。'

# 可學但放置時無實效，仍需作後續技能前置的玩家技能。等級與解鎖目標依當日技能樹驗證。
NO_IDLE_EFFECT = {
    'SA_CASTCANCEL', 'HT_SHOCKWAVE', 'HT_REMOVETRAP', 'DC_UGLYDANCE',
    'MO_BODYRELOCATION', 'RG_CLEANER', 'RG_FLAGGRAFFITI', 'RG_GRAFFITI',
    'RG_TUNNELDRIVE', 'HLIF_AVOID',
    # 2026-10-28 起由停用改為「可以學但不會施放」。
    'AL_WARP', 'MC_CHANGECART', 'WZ_ESTIMATION', 'HT_TALKIEBOX', 'HT_SPRINGTRAP',
}
TRANSIT_TARGETS = {
    'AL_WARP': ['AL_PNEUMA'],
    'SA_CASTCANCEL': ['SA_FREECAST'],
    'HT_SHOCKWAVE': ['HT_CLAYMORETRAP'],
    'DC_UGLYDANCE': ['DC_HUMMING', 'DC_DONTFORGETME', 'DC_FORTUNEKISS', 'DC_SERVICEFORYOU'],
    'RG_TUNNELDRIVE': ['RG_RAID'],
}
TRANSIT = {}
for sid, targets in TRANSIT_TARGETS.items():
    assert SKILLS[sid]['status']['kind'] == 'ready', f'{sid} 的可學狀態已改變'
    levels = set()
    for target in targets:
        assert SKILLS[target]['status']['kind'] == 'ready', f'{target} 的可學狀態已改變'
        requirements = {node['requires'][sid]
                        for job in DATA['jobs'] for node in job['skillTree']
                        if node['id'] == target and sid in node.get('requires', {})}
        assert requirements, f'{sid} 已不是 {target} 的前置'
        levels.update(requirements)
    assert len(levels) == 1, f'{sid} 的過路等級須重新核對：{levels}'
    TRANSIT[sid] = {'minLv': levels.pop(), 'unlocks': targets}

def link(sid):
    return f"[{SKILLS[sid]['name']}（{sid}）](https://ro-idle.app/info/database?type=skills&id={sid})"

def rows(ids, tree):
    result = ['| 技能（ID） | 最高 Lv | 類型 | 資訊站狀態 | 前置／任務條件 | 放置版重點 |',
              '| --- | ---: | --- | --- | --- | --- |']
    for sid in ids:
        node = tree[sid]
        skill = SKILLS[sid]
        req = '、'.join(f"{SKILLS[r]['name']} Lv {lv}" for r, lv in node.get('requires', {}).items()) or '無'
        if node.get('questJobLv'):
            req += f"；任務 Job {node['questJobLv']}，不扣點"
        note = NOTES.get(sid, '各級效果與消耗請見技能直達頁。')
        status = {'ready': '可學', 'disabled': '本遊戲停用', 'pending': '目前無法學習'}.get(skill['status']['kind'], '待查證')
        if skill['status']['kind'] != 'ready' and sid not in NOTES:
            note = f"資訊站標示「{skill['status']['kind']}」；{skill['status'].get('reason', '暫不可用')}"
        result.append(f"| {link(sid)} | {node['maxLv']} | {KIND.get(skill['kind'], skill['kind'])} | {status} | {req} | {note} |")
    return '\n'.join(result)

OUT = ROOT / '技能'
OUT.mkdir(exist_ok=True)
# 進階初學者與進階一轉的技能樹與一般職業相同且同名，不另產生說明，於一般職業頁註明。
HIGH = {j['id'] for j in DATA['jobs'] if j['id'] == 'novice_high' or j['id'].endswith('_high')}
for hid in HIGH:
    assert JOBS[hid]['skillTree'] == JOBS[hid.removesuffix('_high')]['skillTree'], f'{hid} 的技能樹已與一般職業不同，須另產生說明'
written = 0
for job in DATA['jobs']:
    if job['id'] in HIGH:
        continue
    tree = {n['id']: n for n in job['skillTree']}
    change = job.get('jobChange') or {}
    # 轉生二轉：只列相對轉生前二轉新增的技能，以及前置條件不同的繼承技能。
    reborn_of = JOBS[change['rebirthOf'][0]] if change.get('from') in HIGH and change.get('rebirthOf') else None
    parent = JOBS.get(change.get('from', '').removesuffix('_high')) if reborn_of else JOBS.get(change.get('from'))
    base = reborn_of or parent
    base_nodes = {n['id']: n for n in base['skillTree']} if base else {}
    own = [sid for sid in tree if sid not in base_nodes or (reborn_of and tree[sid] != base_nodes[sid])]
    if job['id'] == 'supernovice':
        own = [sid for sid in own if sid not in ('NV_BASIC', 'NV_FIRSTAID')]
    lines = [f"# RO 放置仙境：{job['name']}技能說明", '', f"**最後查證：{DATA['queried']}**", '',
             f"依[資訊站技能資料庫](https://ro-idle.app/info/database?type=skills)與[{job['name']}職業頁](https://ro-idle.app/info/database?type=jobs&id={job['id']})整理。表中最高等級、前置與可用狀態屬已查證資料；「可學」只代表資料庫允許學習，不等於放置版能施放或值得配點。「放置版重點」是依技能描述整理的操作摘要，不代表傷害或收益實測。各級數值、SP、詠唱、冷卻、武器與材料限制請點技能名稱核對。", '']
    if reborn_of:
        changed = [sid for sid in own if sid in base_nodes]
        lines += [f"本職業是{'／'.join(JOBS[r]['name'] for r in change['rebirthOf'])}的轉生職業：由進階{parent['name']}（技能樹與{parent['name']}相同）於 Job {change.get('minJobLv', '待查證')} 以上轉職，Job 上限 {job['maxJobLv']}。繼承技能請見[{parent['name']}技能說明]({parent['name']}技能說明.md)、[{reborn_of['name']}技能說明]({reborn_of['name']}技能說明.md)；下表只列轉生後新增的技能" + (f"，以及前置條件與{reborn_of['name']}不同的{'、'.join(SKILLS[sid]['name'] for sid in changed)}" if changed else '') + '。', '']
    elif parent:
        lines += [f"本職業由{parent['name']}轉職；繼承的一轉技能請見[{parent['name']}技能說明]({parent['name']}技能說明.md)。", '']
    if f"{job['id']}_high" in HIGH:
        lines += [f"轉生後的進階{job['name']}技能樹與本職業相同，配點規則也相同；進階初學者另見[初學者技能說明](初學者技能說明.md)。", ''] if job['id'] != 'novice' else ['轉生後的進階初學者技能樹相同，但初學者技能轉生後自動學會，升 Job 不給技能點。', '']
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
                  '| 技能（ID） | 最高 Lv | 類型 | 放置版用途 |', '| --- | ---: | --- | --- |']
        lines += [f"| {link(sid)} | {SKILLS[sid]['maxLv']} | {KIND.get(SKILLS[sid]['kind'], SKILLS[sid]['kind'])} | {NOTES.get(sid, '各級效果請見技能直達頁。')} |" for sid in homun]
        lines += ['']
    (OUT / f"{job['name']}技能說明.md").write_text('\n'.join(lines))
    written += 1

tree_ids = {node['id'] for job in DATA['jobs'] for node in job['skillTree']}
homun_ids = {sid for sid in SKILLS if sid.startswith(('HAMI_', 'HFLI_', 'HLIF_', 'HVAN_'))}
# 沒有等級上限的條目是內部狀態（如 BERSERK_RECOVERY），不在資訊站公開的技能清單。
other_ids = {sid for sid in SKILLS if 'maxLv' in SKILLS[sid]} - tree_ids - homun_ids
other_lines = ['# RO 放置仙境：資料庫其他技能', '', f"**最後查證：{DATA['queried']}**", '',
               '以下技能見於[資訊站技能資料庫](https://ro-idle.app/info/database?type=skills)，但沒有列入任何玩家職業技能樹，也不是上表的生命體技能。不能據此認定玩家可以投入 Job 點數學習。', '',
               '| 技能（ID） | 最高 Lv | 類型 |', '| --- | ---: | --- |']
other_lines += [f"| {link(sid)} | {SKILLS[sid]['maxLv']} | {KIND.get(SKILLS[sid]['kind'], SKILLS[sid]['kind'])} |" for sid in sorted(other_ids)]
(OUT / '資料庫其他技能.md').write_text('\n'.join(other_lines) + '\n')
(ROOT / 'data' / f"ro-idle技能重點_{DATA['queried']}.json").write_text(
    json.dumps({'queried': DATA['queried'], 'source': DATA['source'], 'notes': NOTES,
                'noIdleEffect': sorted(NO_IDLE_EFFECT), 'transit': TRANSIT}, ensure_ascii=False, indent=2) + '\n')
print(f"產生 {written} 份職業技能說明與 1 份其他技能說明，來源 {SNAPSHOT.name}")
