"use client";

import { useState, useMemo } from "react";
import {
  ActiveFilters,
  FilterCategory,
  emptyFilters,
} from "@/types/formation";
import { FilterCounts } from "@/lib/filters";

interface FilterPanelProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  counts: FilterCounts;
  priceRange: [number, number];
  onClose?: () => void;
  isMobile?: boolean;
}

interface FilterSectionProps {
  title: string;
  category: FilterCategory;
  values: Record<string, number>;
  selected: string[];
  onToggle: (category: FilterCategory, value: string) => void;
  searchable?: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterSection({
  title,
  category,
  values,
  selected,
  onToggle,
  searchable = false,
}: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(selected.length > 0);
  const [search, setSearch] = useState("");

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
    if (searchable && search) {
      const q = search.toLowerCase();
      return entries.filter(([name]) => name.toLowerCase().includes(q));
    }
    return entries;
  }, [values, search, searchable]);

  return (
    <div className="border-b border-border-light">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {selected.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1.5 text-[10px] font-medium text-white">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {searchable && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Filtrer ${title.toLowerCase()}...`}
              className="mb-2 w-full rounded border border-border-light bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-blue-gray-light focus:outline-none"
            />
          )}
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
            {sortedEntries.length === 0 && (
              <p className="text-xs text-text-muted py-1">Aucun résultat</p>
            )}
            {sortedEntries.map(([name, count]) => (
              <label
                key={name}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-surface-alt transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => onToggle(category, name)}
                  className="h-3.5 w-3.5 rounded border-border text-navy focus:ring-navy/30 accent-navy"
                />
                <span className="flex-1 truncate text-text-primary">
                  {name}
                </span>
                <span className="text-text-muted tabular-nums">{count}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({
  filters,
  onFiltersChange,
  counts,
  priceRange,
  onClose,
  isMobile = false,
}: FilterPanelProps) {
  const [prixMin, setPrixMin] = useState(filters.prixMin ?? priceRange[0]);
  const [prixMax, setPrixMax] = useState(filters.prixMax ?? priceRange[1]);

  const handleToggle = (category: FilterCategory, value: string) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [category]: updated });
  };

  const handleReset = () => {
    setPrixMin(priceRange[0]);
    setPrixMax(priceRange[1]);
    onFiltersChange(emptyFilters);
  };

  const handlePriceChange = (min: number, max: number) => {
    setPrixMin(min);
    setPrixMax(max);
    onFiltersChange({
      ...filters,
      prixMin: min <= priceRange[0] ? null : min,
      prixMax: max >= priceRange[1] ? null : max,
    });
  };

  const hasFilters =
    filters.ecole.length > 0 ||
    filters.ville.length > 0 ||
    filters.domaine.length > 0 ||
    filters.niveau.length > 0 ||
    filters.duree.length > 0 ||
    filters.rythme.length > 0 ||
    filters.prixMin !== null ||
    filters.prixMax !== null;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className={`flex flex-col h-full ${isMobile ? "" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">Filtres</span>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={handleReset}
              className="text-xs text-blue-gray hover:text-navy transition-colors"
            >
              Réinitialiser
            </button>
          )}
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-text-muted hover:text-text-primary"
              aria-label="Fermer les filtres"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <FilterSection
          title="École"
          category="ecole"
          values={counts.ecole}
          selected={filters.ecole}
          onToggle={handleToggle}
          searchable
        />
        <FilterSection
          title="Ville"
          category="ville"
          values={counts.ville}
          selected={filters.ville}
          onToggle={handleToggle}
          searchable
        />
        <FilterSection
          title="Domaine"
          category="domaine"
          values={counts.domaine}
          selected={filters.domaine}
          onToggle={handleToggle}
        />
        <FilterSection
          title="Niveau"
          category="niveau"
          values={counts.niveau}
          selected={filters.niveau}
          onToggle={handleToggle}
        />
        <FilterSection
          title="Durée"
          category="duree"
          values={counts.duree}
          selected={filters.duree}
          onToggle={handleToggle}
        />
        <FilterSection
          title="Rythme"
          category="rythme"
          values={counts.rythme}
          selected={filters.rythme}
          onToggle={handleToggle}
        />

      </div>
    </div>
  );
}

function PriceFilter({
  min,
  max,
  currentMin,
  currentMax,
  onChange,
  formatPrice,
}: {
  min: number;
  max: number;
  currentMin: number;
  currentMax: number;
  onChange: (min: number, max: number) => void;
  formatPrice: (v: number) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (min === max || max === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2.5 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
      >
        <span>Prix</span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          <div className="space-y-2">
            <input
              type="range"
              min={min}
              max={max}
              value={currentMin}
              onChange={(e) =>
                onChange(
                  Math.min(Number(e.target.value), currentMax),
                  currentMax
                )
              }
              className="w-full"
            />
            <input
              type="range"
              min={min}
              max={max}
              value={currentMax}
              onChange={(e) =>
                onChange(
                  currentMin,
                  Math.max(Number(e.target.value), currentMin)
                )
              }
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-text-secondary tabular-nums">
            <span>{formatPrice(currentMin)}</span>
            <span>{formatPrice(currentMax)}</span>
          </div>
        </div>
      )}
    </>
  );
}
