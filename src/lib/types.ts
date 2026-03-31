/**
 * This file re-exports types from the canonical source at @/types/formation.
 * It is kept for backward compatibility but should not be imported directly.
 * Use `@/types/formation` instead.
 */
export type {
  BlocCompetences,
  BlocCompetencesRaw,
  RncpDataRaw,
  FormationRaw,
  Formation,
  SortConfig,
  ActiveFilters,
  FilterCategory,
} from "../types/formation";

export { normalizeFormation, emptyFilters } from "../types/formation";
