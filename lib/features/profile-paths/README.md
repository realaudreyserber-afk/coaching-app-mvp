# Module M10 — Parcours Profil-Spécifique

Ce module permet de détecter le profil d'un utilisateur lors de la génération de son plan et d'adapter en conséquence le programme nutritionnel/sportif généré par Gemini ainsi que le ton et les consignes de sécurité du Coach IA.

## Profils Gérés

1. `standard` : Chemin de recomposition corporelle par défaut.
2. `high-bf` : Utilisateurs en situation d'obésité ou surpoids important (sécurité articulaire, déficit progressif, pas de sauts).
3. `ex-athlete` : Anciens sportifs de haut niveau (mémoire musculaire, volume plus élevé, RPE).
4. `glp1` : Utilisateurs sous traitement analogue du GLP-1 (maintien musculaire critique, haute teneur en protéines, fractionnement de repas).
5. `post-bariatric` : Utilisateurs ayant subi une chirurgie bariatrique (repas très petits de 150-200g max, 5-6 repas/jour, solide-liquide séparés).

## Détection automatique

L'algorithme de détection dans `detector.ts` analyse le document utilisateur (taille, poids, médicaments, pathologies déclarées) pour assigner le profil approprié.

## Rollback

Désactiver le flag `feature_profile_paths` dans Firebase Remote Config. Le prompt par défaut du coach et du planificateur s'appliquera de nouveau.
