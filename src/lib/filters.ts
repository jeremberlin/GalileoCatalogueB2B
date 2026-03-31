import { Formation, ActiveFilters, FilterCategory, emptyFilters } from "@/types/formation";

export function applyFilters(
  formations: Formation[],
  filters: ActiveFilters
): Formation[] {
  return formations.filter((f) => {
    // Categorical filters: OR within category, AND between categories
    const categoricalChecks: [FilterCategory, string][] = [
      ["ecole", f.ecole],
      ["ville", f.ville],
      ["domaine", f.domaine],
      ["niveau", f.niveau],
      ["duree", f.duree],
      ["rythme", f.rythme],
    ];

    for (const [category, value] of categoricalChecks) {
      const selected = filters[category];
      if (selected.length > 0 && !selected.includes(value)) {
        return false;
      }
    }

    // Price range filter
    if (filters.prixMin !== null && f.prix !== null && f.prix < filters.prixMin) {
      return false;
    }
    if (filters.prixMax !== null && f.prix !== null && f.prix > filters.prixMax) {
      return false;
    }

    return true;
  });
}

export interface FilterCounts {
  ecole: Record<string, number>;
  ville: Record<string, number>;
  domaine: Record<string, number>;
  niveau: Record<string, number>;
  duree: Record<string, number>;
  rythme: Record<string, number>;
}

/**
 * Compute filter counts based on currently filtered results,
 * but for each category, count as if that category's filter was not applied
 * (so users can see how many items a new selection would add).
 */
export function computeFilterCounts(
  formations: Formation[],
  filters: ActiveFilters
): FilterCounts {
  const categories: FilterCategory[] = [
    "ecole",
    "ville",
    "domaine",
    "niveau",
    "duree",
    "rythme",
  ];

  const counts: FilterCounts = {
    ecole: {},
    ville: {},
    domaine: {},
    niveau: {},
    duree: {},
    rythme: {},
  };

  // For each category, apply all OTHER filters and count values in this category
  for (const cat of categories) {
    const filtersWithoutCat: ActiveFilters = {
      ...filters,
      [cat]: [], // Remove this category's filter
    };
    const filtered = applyFilters(formations, filtersWithoutCat);
    const countMap: Record<string, number> = {};
    for (const f of filtered) {
      const value = f[cat] as string;
      if (value) {
        countMap[value] = (countMap[value] || 0) + 1;
      }
    }
    counts[cat] = countMap;
  }

  return counts;
}

export function getPriceRange(formations: Formation[]): [number, number] {
  let min = Infinity;
  let max = 0;
  for (const f of formations) {
    if (f.prix !== null && f.prix > 0) {
      if (f.prix < min) min = f.prix;
      if (f.prix > max) max = f.prix;
    }
  }
  if (min === Infinity) min = 0;
  return [min, max];
}

export function hasActiveFilters(filters: ActiveFilters): boolean {
  return (
    filters.ecole.length > 0 ||
    filters.ville.length > 0 ||
    filters.domaine.length > 0 ||
    filters.niveau.length > 0 ||
    filters.duree.length > 0 ||
    filters.rythme.length > 0 ||
    filters.prixMin !== null ||
    filters.prixMax !== null
  );
}

export { emptyFilters };
