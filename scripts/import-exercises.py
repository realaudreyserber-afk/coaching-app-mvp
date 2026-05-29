"""
Importateur "Functional Fitness Exercise Database v2.9" (xlsx) -> JSON NoDream.

Produit lib/features/exercise-db/data/exercises.json :
  [{ name, name_fr, level, muscle, equipment, pattern, mechanics, unilateral, body_region }]

- Niveaux 8 -> 3 (RAG : debutant / intermediaire / avance).
- Équipement / muscles / patterns traduits via maps finies (alignées sur les
  slugs rag-coach quand possible).
- Noms : composition FR best-effort via glossaire (franglais assumé — usuel en
  coaching FR) ; name (EN) conservé comme référence canonique.

Usage : python scripts/import-exercises.py "H:/utilisateur/Downloads/Functional+Fitness+Exercise+Database+(version+2.9).xlsx"
Source : Functional Fitness Exercise Database v2.9 (Jensen Van Diepen).
"""
import sys, json, re, os
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else r'H:/utilisateur/Downloads/Functional+Fitness+Exercise+Database+(version+2.9).xlsx'
OUT = os.path.join('lib', 'features', 'exercise-db', 'data', 'exercises.json')

LEVEL_MAP = {
    'beginner': 'debutant', 'novice': 'debutant',
    'intermediate': 'intermediaire',
    'advanced': 'avance', 'expert': 'avance', 'master': 'avance',
    'grand master': 'avance', 'legendary': 'avance',
}
EQUIP_MAP = {
    'kettlebell': 'kettlebell', 'dumbbell': 'halteres', 'barbell': 'barre',
    'bodyweight': 'aucun', 'cable': 'poulie', 'gymnastic rings': 'anneaux',
    'suspension trainer': 'sangles', 'pull up bar': 'barre_traction',
    'superband': 'elastique', 'miniband': 'elastique', 'resistance band': 'elastique',
    'weight plate': 'disque', 'stability ball': 'swiss_ball', 'macebell': 'macebell',
    'clubbell': 'clubbell', 'landmine': 'landmine', 'sandbag': 'sac_leste',
    'heavy sandbag': 'sac_leste', 'bulgarian bag': 'sac_bulgare',
    'parallette bars': 'barres_paralleles', 'trap bar': 'trap_bar',
    'medicine ball': 'medecine_ball', 'slam ball': 'slam_ball', 'sliders': 'sliders',
    'ab wheel': 'roue_abdo', 'battle ropes': 'cordes', 'box': 'box', 'bench': 'banc',
    'ez bar': 'barre_ez', 'indian club': 'club_indien', 'steel mace': 'masse',
}
MUSCLE_MAP = {
    'quadriceps': 'quadriceps', 'shoulders': 'epaules', 'abdominals': 'abdominaux',
    'back': 'dos', 'glutes': 'fessiers', 'chest': 'pectoraux', 'biceps': 'biceps',
    'triceps': 'triceps', 'hip flexors': 'flechisseurs_hanche', 'calves': 'mollets',
    'hamstrings': 'ischio_jambiers', 'forearms': 'avant_bras', 'abductors': 'abducteurs',
    'adductors': 'adducteurs', 'trapezius': 'trapezes', 'shins': 'tibias',
}
PATTERN_MAP = {
    'knee dominant': 'squat', 'hip hinge': 'hinge', 'vertical push': 'poussee_verticale',
    'horizontal push': 'poussee_horizontale', 'vertical pull': 'tirage_vertical',
    'horizontal pull': 'tirage_horizontal', 'rotational': 'rotation',
    'isometric hold': 'gainage_iso', 'elbow flexion': 'flexion_coude',
    'elbow extension': 'extension_coude', 'anti-extension': 'anti_extension',
    'anti-rotational': 'anti_rotation', 'anti-lateral flexion': 'anti_flexion_laterale',
    'spinal flexion': 'flexion_rachis', 'spinal rotational': 'rotation_rachis',
    'hip internal rotation': 'rotation_interne_hanche',
}
# Glossaire pour composer un nom FR (remplacement de tokens, ordre conservé).
NAME_GLOSSARY = {
    'bodyweight': 'poids du corps', 'dumbbell': 'haltère', 'barbell': 'barre',
    'kettlebell': 'kettlebell', 'cable': 'poulie', 'band': 'élastique',
    'glute bridge': 'pont fessier', 'hip thrust': 'hip thrust', 'squat': 'squat',
    'goblet': 'goblet', 'front squat': 'front squat', 'back squat': 'back squat',
    'split squat': 'split squat', 'lunge': 'fente', 'reverse lunge': 'fente arrière',
    'step up': 'montée sur box', 'deadlift': 'soulevé de terre', 'romanian': 'roumain',
    'push up': 'pompe', 'pushup': 'pompe', 'bench press': 'développé couché',
    'overhead press': 'développé militaire', 'shoulder press': 'développé épaules',
    'row': 'rowing', 'pull up': 'traction', 'pullup': 'traction', 'chin up': 'traction supination',
    'curl': 'curl', 'tricep': 'triceps', 'extension': 'extension', 'press': 'développé',
    'plank': 'planche', 'dead bug': 'dead bug', 'bird dog': 'bird dog',
    'mountain climber': 'mountain climber', 'crunch': 'crunch', 'sit up': 'sit up',
    'calf raise': 'extension mollets', 'lateral raise': 'élévation latérale',
    'swing': 'swing', 'clean': 'épaulé', 'snatch': 'arraché', 'thruster': 'thruster',
    'carry': 'port', 'farmer': 'fermier', 'single arm': 'unilatéral', 'single leg': 'unilatéral',
    'seated': 'assis', 'standing': 'debout', 'kneeling': 'à genoux', 'incline': 'incliné',
    'decline': 'décliné', 'alternating': 'alterné',
}

def slug(s):
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s

# Équipement en TÊTE de nom -> rejeté en suffixe FR "(...)" (meilleur ordre FR).
EQUIP_LEAD = {
    'bodyweight': 'poids du corps', 'dumbbell': 'haltère', 'barbell': 'barre',
    'kettlebell': 'kettlebell', 'cable': 'poulie', 'stability ball': 'swiss ball',
    'gymnastic rings': 'anneaux', 'suspension trainer': 'sangles', 'clubbell': 'clubbell',
    'macebell': 'macebell', 'landmine': 'landmine', 'sandbag': 'sac lesté',
    'heavy sandbag': 'sac lesté', 'trap bar': 'trap bar', 'ez bar': 'barre EZ',
    'medicine ball': 'médecine ball', 'slam ball': 'slam ball', 'superband': 'élastique',
    'miniband': 'mini-élastique', 'weight plate': 'disque', 'pull up bar': 'barre de traction',
    'parallette bars': 'barres parallèles', 'bulgarian bag': 'sac bulgare',
    'indian club': 'club indien', 'steel mace': 'masse', 'battle ropes': 'cordes',
    'ab wheel': 'roue abdo', 'sliders': 'sliders', 'box': 'box', 'bench': 'banc',
}

def fr_name(name_en):
    n = name_en.strip()
    low = n.lower()
    suffix = ''
    for en in sorted(EQUIP_LEAD, key=len, reverse=True):
        if low.startswith(en + ' '):
            suffix = f' ({EQUIP_LEAD[en]})'
            n = n[len(en):].strip()
            break
    n = n.lower()
    for en in sorted(NAME_GLOSSARY, key=len, reverse=True):
        n = re.sub(r'\b' + re.escape(en) + r'\b', NAME_GLOSSARY[en], n)
    n = (n[:1].upper() + n[1:]) if n else name_en
    return n + suffix

def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb['Exercises']
    rows = list(ws.iter_rows(min_row=17, values_only=True))  # données dès la ligne 17
    out = []
    seen = set()
    for r in rows:
        name = (r[1] or '').strip() if r[1] else ''
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        lvl = LEVEL_MAP.get(str(r[4] or '').strip().lower(), 'intermediaire')
        muscle_en = str(r[5] or '').strip().lower()
        equip_en = str(r[9] or '').strip().lower()
        pat_en = str(r[21] or '').strip().lower()
        out.append({
            'name': name,
            'name_fr': fr_name(name),
            'level': lvl,
            'muscle': MUSCLE_MAP.get(muscle_en, slug(muscle_en) if muscle_en else None),
            'equipment': EQUIP_MAP.get(equip_en, slug(equip_en) if equip_en else None),
            'pattern': PATTERN_MAP.get(pat_en, None),
            'mechanics': 'compose' if str(r[29] or '').strip().lower() == 'compound' else ('isolation' if str(r[29] or '').strip().lower() == 'isolation' else None),
            'unilateral': str(r[30] or '').strip().lower() in ('unilateral', 'contralateral', 'ipsilateral'),
            'body_region': slug(str(r[27] or '').strip().lower()) or None,
        })
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    size_kb = os.path.getsize(OUT) / 1024
    print(f'OK {len(out)} exercices -> {OUT} ({size_kb:.0f} Ko)')
    # petit échantillon
    for ex in out[:4]:
        print('  ', ex['name'], '->', ex['name_fr'], '|', ex['level'], '|', ex['muscle'], '|', ex['equipment'], '|', ex['pattern'])

if __name__ == '__main__':
    main()
