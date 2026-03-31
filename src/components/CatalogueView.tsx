"use client";

import { useState, useMemo, useCallback } from "react";
import MiniSearch from "minisearch";
import {
  Formation,
  SortConfig,
  ActiveFilters,
  emptyFilters,
} from "@/types/formation";
import { buildSearchIndex, searchFormations } from "@/lib/search";
import {
  applyFilters,
  computeFilterCounts,
  getPriceRange,
} from "@/lib/filters";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import ResultsTable, {
  SkeletonTable,
  EmptyState,
} from "@/components/ResultsTable";
import FormationSheet from "@/components/FormationSheet";

interface CatalogueViewProps {
  formations: Formation[];
  loading: boolean;
}

export default function CatalogueView({ formations, loading }: CatalogueViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(emptyFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedFormation, setSelectedFormation] = useState<Formation | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Build search index
  const searchIndex = useMemo(() => {
    if (formations.length === 0) return null;
    return buildSearchIndex(formations);
  }, [formations]);

  // Search + Filter pipeline
  const searchResults = useMemo(() => {
    if (!searchIndex || formations.length === 0) return formations;
    return searchFormations(searchQuery, formations, searchIndex);
  }, [searchQuery, formations, searchIndex]);

  const filteredResults = useMemo(() => {
    return applyFilters(searchResults, activeFilters);
  }, [searchResults, activeFilters]);

  // Sort
  const sortedResults = useMemo(() => {
    if (!sortConfig) return filteredResults;
    const { key, direction } = sortConfig;
    return [...filteredResults].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return direction === "asc" ? -1 : 1;
      if (aStr > bStr) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredResults, sortConfig]);

  // Filter counts
  const filterCounts = useMemo(() => {
    return computeFilterCounts(searchResults, activeFilters);
  }, [searchResults, activeFilters]);

  const priceRange = useMemo(() => {
    return getPriceRange(formations);
  }, [formations]);

  const handleSort = useCallback(
    (key: keyof Formation) => {
      setSortConfig((prev) => {
        if (prev && prev.key === key) {
          if (prev.direction === "asc") return { key, direction: "desc" };
          return null;
        }
        return { key, direction: "asc" };
      });
    },
    []
  );

  const handleSelectFormation = useCallback((f: Formation) => {
    setSelectedFormation(f);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedFormation(null);
  }, []);

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside
          className={`hidden lg:flex shrink-0 border-r border-border bg-white transition-all duration-200 overflow-hidden ${
            sidebarOpen ? "w-64" : "w-0"
          }`}
        >
          {sidebarOpen && (
            <div className="w-64 flex flex-col h-full">
              <FilterPanel
                filters={activeFilters}
                onFiltersChange={setActiveFilters}
                counts={filterCounts}
                priceRange={priceRange}
              />
            </div>
          )}
        </aside>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden lg:flex shrink-0 items-center justify-center w-5 border-r border-border bg-surface hover:bg-surface-alt text-text-muted hover:text-text-secondary transition-colors"
          aria-label={sidebarOpen ? "Masquer les filtres" : "Afficher les filtres"}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`transition-transform duration-200 ${sidebarOpen ? "" : "rotate-180"}`}
          >
            <path
              d="M6.5 2L3.5 5L6.5 8"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto p-5">
          {/* Search bar */}
          <div className="mb-4 max-w-2xl">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>

          {/* Content */}
          {loading ? (
            <SkeletonTable />
          ) : sortedResults.length === 0 ? (
            <EmptyState />
          ) : (
            <ResultsTable
              formations={sortedResults}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectFormation={handleSelectFormation}
              totalCount={sortedResults.length}
            />
          )}
        </main>
      </div>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 lg:hidden"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl lg:hidden flex flex-col">
            <FilterPanel
              filters={activeFilters}
              onFiltersChange={setActiveFilters}
              counts={filterCounts}
              priceRange={priceRange}
              onClose={() => setMobileFiltersOpen(false)}
              isMobile
            />
          </div>
        </>
      )}

      {/* Formation detail sheet */}
      <FormationSheet
        formation={selectedFormation}
        onClose={handleCloseSheet}
      />
    </>
  );
}
