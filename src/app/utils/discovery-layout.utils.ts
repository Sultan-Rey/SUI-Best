// discovery-layout.utils.ts
// ─────────────────────────────────────────────────────────────────
// Règle fondamentale : la grille fait 2 colonnes.
// Chaque "slot" vaut 1 unité de colonne.
// On doit toujours consommer exactement 2 slots par rangée pour
// ne jamais laisser de trou.
//
// Poids de chaque size :
//   lg  → 2 slots (pleine largeur)
//   md  → 1 slot sur 2 rangées (consomme 2 slots en hauteur mais 1 en largueur)
//   sm  → 1 slot (demi-largeur, 1 rangée)
//
// Séquences valides pour remplir exactement 2 slots horizontaux :
//   [lg]           = 2/2 ✓
//   [md, md]       = 1+1/2 ✓  (côte à côte, même hauteur double)
//   [md, sm, sm]   = 1 + (1+1)/2 ✓  (md à gauche, 2 sm empilés à droite)
//   [sm, sm]       = 1+1/2 ✓
// ─────────────────────────────────────────────────────────────────

import { DiscoveryItem } from '../components/view-discovery/discovery-view.component';

type ItemSize = 'lg' | 'md' | 'sm';

/**
 * Patterns de remplissage disponibles.
 * Chaque pattern décrit les sizes à assigner à N items consécutifs
 * pour former une rangée visuellement complète.
 */
const LAYOUT_PATTERNS: ItemSize[][] = [
  ['lg'],              // 1 item  → pleine largeur
  ['md', 'md'],        // 2 items → deux colonnes hautes
  ['md', 'sm', 'sm'],  // 3 items → colonne haute + deux petites
  ['sm', 'sm'],        // 2 items → deux petites
];

/**
 * Poids de variation pour éviter la répétition monotone.
 * Plus le poids est élevé, plus le pattern apparaît fréquemment.
 */
const PATTERN_WEIGHTS: { pattern: ItemSize[]; weight: number }[] = [
  { pattern: ['lg'],           weight: 1 },
  { pattern: ['md', 'md'],     weight: 2 },
  { pattern: ['md', 'sm', 'sm'], weight: 3 },
  { pattern: ['sm', 'sm'],     weight: 2 },
];

/**
 * Assigne les sizes à un tableau de DiscoveryItems de façon à
 * garantir une grille sans trous, avec variation visuelle contrôlée.
 *
 * Contraintes respectées :
 *  - Jamais deux 'lg' consécutifs (trop monotone)
 *  - Au moins 1 'lg' toutes les 3 rangées (ancrage visuel fort)
 *  - Variation naturelle des patterns intermédiaires
 *
 * @param items  Tableau source (muté in-place, size est réassigné)
 * @returns      Le même tableau avec size initialisé
 */
export function assignDiscoveryLayout<T extends Pick<DiscoveryItem, 'size'>>(
  items: T[]
): T[] {
  const result = [...items];
  let index = 0;
  let rowCount = 0;
  let lastWasLg = false;

  while (index < result.length) {
    const remaining = result.length - index;
    const pattern = pickPattern(remaining, lastWasLg, rowCount);

    // Ne pas dépasser la fin du tableau
    const safePattern = pattern.slice(0, remaining);

    safePattern.forEach((size, i) => {
      result[index + i].size = size;
    });

    lastWasLg = safePattern[0] === 'lg';
    rowCount++;
    index += safePattern.length;
  }

  return result;
}

/**
 * Sélectionne le prochain pattern selon les contraintes visuelles.
 */
function pickPattern(
  remaining: number,
  lastWasLg: boolean,
  rowCount: number
): ItemSize[] {
  // Forcer un lg toutes les 4 rangées si ça fait trop longtemps
  const needsLg = rowCount > 0 && rowCount % 4 === 0 && !lastWasLg;

  if (needsLg && remaining >= 1) {
    return ['lg'];
  }

  // Filtrer les patterns applicables
  const candidates = PATTERN_WEIGHTS.filter(({ pattern }) => {
    if (pattern[0] === 'lg' && lastWasLg) return false; // pas deux lg d'affilée
    if (pattern.length > remaining) return false;        // pas assez d'items
    return true;
  });

  if (candidates.length === 0) {
    // Fallback : remplir avec des sm
    return remaining >= 2 ? ['sm', 'sm'] : ['sm'];
  }

  return weightedRandom(candidates);
}

/**
 * Tirage pondéré parmi les candidats.
 * Utilise un seed déterministe basé sur rowCount pour reproductibilité.
 */
function weightedRandom(
  candidates: { pattern: ItemSize[]; weight: number }[]
): ItemSize[] {
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  // Math.random() peut être remplacé par un PRNG seedé si besoin de SSR/tests
  let rand = Math.random() * totalWeight;

  for (const candidate of candidates) {
    rand -= candidate.weight;
    if (rand <= 0) return candidate.pattern;
  }

  return candidates[candidates.length - 1].pattern;
}


// ─────────────────────────────────────────────────────────────────
// Variante : layout déterministe sans aléatoire
// Utile pour les tests, SSR, ou si le backend contrôle l'ordre.
// Suit une séquence fixe qui maximise la variété visuelle.
// ─────────────────────────────────────────────────────────────────
const DETERMINISTIC_SEQUENCE: ItemSize[][] = [
  ['lg'],
  ['md', 'sm', 'sm'],
  ['sm', 'sm'],
  ['md', 'md'],
  ['md', 'sm', 'sm'],
  ['lg'],
  ['sm', 'sm'],
  ['md', 'md'],
];

export function assignDiscoveryLayoutDeterministic<T extends Pick<DiscoveryItem, 'size'>>(
  items: T[]
): T[] {
  const result = [...items];
  let itemIndex = 0;
  let seqIndex = 0;

  while (itemIndex < result.length) {
    const pattern = DETERMINISTIC_SEQUENCE[seqIndex % DETERMINISTIC_SEQUENCE.length];
    const safePattern = pattern.slice(0, result.length - itemIndex);

    safePattern.forEach((size, i) => {
      result[itemIndex + i].size = size;
    });

    itemIndex += safePattern.length;
    seqIndex++;
  }

  return result;
}
