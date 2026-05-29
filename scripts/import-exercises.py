"""
Importateur exercices — version FR restructurée (00_MASTER_FR.xlsx).

Source : exercises_FR (Functional Fitness v2.9 traduit + restructuré par famille).
Bien mieux structuré que le xlsx EN : famille (push/pull/squat/hinge/core/autres),
niveau, Nom (FR), muscle/équipement/pattern FR, mécanique, latéralité, ET liens
démo + explication YouTube (extraits depuis les hyperliens des cellules).

Produit lib/features/exercise-db/data/exercises.json :
  [{ name, name_fr, family, level, muscle, equipment, pattern, mechanics,
     unilateral, region, demo_url, explain_url }]

Usage : python scripts/import-exercises.py "H:/utilisateur/Downloads/exercises_FR_2/exercises_FR/00_MASTER_FR.xlsx"
"""
import sys, json, re, os, unicodedata
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else r'H:/utilisateur/Downloads/exercises_FR_2/exercises_FR/00_MASTER_FR.xlsx'
OUT = os.path.join('lib', 'features', 'exercise-db', 'data', 'exercises.json')

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def slug(s):
    s = strip_accents(str(s).lower().strip())
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s or None

LEVEL_MAP = {
    'debutant': 'debutant', 'novice': 'debutant',
    'intermediaire': 'intermediaire',
    'avance': 'avance', 'expert': 'avance', 'expert_plus': 'avance', 'expert+': 'avance',
    'master': 'avance', 'grand_master': 'avance', 'legendary': 'avance',
}
EQUIP_MAP = {
    'poids_de_corps': 'aucun', 'haltere': 'halteres', 'halteres': 'halteres',
    'barre': 'barre', 'kettlebell': 'kettlebell', 'poulie': 'poulie', 'cable': 'poulie',
    'elastique': 'elastique', 'superband': 'elastique', 'miniband': 'elastique',
    'anneaux': 'anneaux', 'anneaux_de_gymnastique': 'anneaux', 'sangles': 'sangles',
    'trx': 'sangles', 'entraineur_en_suspension': 'sangles',
    'barre_de_traction': 'barre_traction', 'swiss_ball': 'swiss_ball',
    'ballon_de_stabilite': 'swiss_ball', 'disque': 'disque', 'plaque_de_poids': 'disque',
    'trap_bar': 'trap_bar', 'barre_ez': 'barre_ez', 'sac_de_sable': 'sac_leste',
    'sac_de_sable_lourd': 'sac_leste', 'sac_bulgare': 'sac_bulgare',
    'barres_paralleles': 'barres_paralleles', 'parallettes': 'barres_paralleles',
    'medecine_ball': 'medecine_ball', 'sliders': 'sliders', 'banc': 'banc', 'box': 'box',
}

def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)  # full load (pour les hyperliens)
    ws = wb['Master FR']
    hdr = [str(c.value).strip() if c.value else '' for c in ws[1]]
    col = {h: i for i, h in enumerate(hdr)}

    def get(row, name):
        i = col.get(name)
        return row[i].value if i is not None and row[i].value not in (None, '') else None

    def link(row, name):
        i = col.get(name)
        c = row[i] if i is not None else None
        return c.hyperlink.target if (c is not None and c.hyperlink) else None

    out = []
    seen = set()
    for row in ws.iter_rows(min_row=2):
        name = (str(get(row, 'Exercice (EN)')).strip() if get(row, 'Exercice (EN)') else '')
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        lvl_raw = slug(get(row, 'Niveau') or '')
        equip_raw = slug(get(row, 'Équipement') or '')
        out.append({
            'name': name,
            'name_fr': (str(get(row, 'Nom (FR)')).strip() if get(row, 'Nom (FR)') else name),
            'family': slug(get(row, 'Famille') or ''),
            'level': LEVEL_MAP.get(lvl_raw, 'intermediaire'),
            'muscle': slug(get(row, 'Groupe musculaire') or ''),
            'equipment': EQUIP_MAP.get(equip_raw, equip_raw),
            'pattern': slug(get(row, 'Pattern') or ''),
            'mechanics': 'compose' if slug(get(row, 'Mécanique') or '') in ('polyarticulaire', 'compose', 'compound')
                         else ('isolation' if slug(get(row, 'Mécanique') or '') == 'isolation' else None),
            'unilateral': slug(get(row, 'Latéralité') or '') in ('unilateral', 'contralateral', 'ipsilateral'),
            'region': slug(get(row, 'Région') or ''),
            'demo_url': link(row, 'Démo orig.'),
            'explain_url': link(row, 'Explic. orig.'),
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    size_kb = os.path.getsize(OUT) / 1024
    sys.stdout.reconfigure(encoding='utf-8')
    print(f'OK {len(out)} exercices -> {OUT} ({size_kb:.0f} Ko)')
    from collections import Counter
    print('familles:', dict(Counter(e['family'] for e in out)))
    print('niveaux:', dict(Counter(e['level'] for e in out)))
    print('avec demo_url:', sum(1 for e in out if e['demo_url']))
    for e in out[:3]:
        print('  ', e['name_fr'], '|', e['family'], e['level'], e['muscle'], e['equipment'], '| demo:', (e['demo_url'] or '')[:40])

if __name__ == '__main__':
    main()
