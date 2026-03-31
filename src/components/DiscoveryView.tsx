"use client";

import { useState, useMemo, useCallback } from "react";
import { Formation, RncpTitle, BlocCompetences } from "@/types/formation";

interface DiscoveryViewProps {
  titles: RncpTitle[];
  formations: Formation[];
  loading: boolean;
}

type ViewMode = "browse" | "search-results" | "title-detail";

/* ───────────────────────── helpers ───────────────────────── */

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatPrice(prix: number): string {
  if (prix === 0) return "—";
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(prix);
}

function priceRange(prixMin: number, prixMax: number): string {
  if (prixMin === 0 && prixMax === 0) return "";
  if (prixMin === prixMax) {
    return formatPrice(prixMin) + " €";
  }
  return formatPrice(prixMin) + " – " + formatPrice(prixMax) + " €";
}

function compactVilles(villes: string[], max: number): string {
  if (villes.length === 0) return "";
  const shown = villes.slice(0, max);
  const rest = villes.length - max;
  const label = shown.join(", ");
  if (rest > 0) return label + " +" + rest;
  return label;
}

/** Clean a formation nomProduit for display: strip école prefix, dates, year suffixes, and deduplicate segments */
function cleanFormationName(nomProduit: string, ecole: string, ville: string): string {
  let name = nomProduit;

  // 1. Remove école/BU prefix: strip everything up to and including the first " - " after school/city part
  // Match patterns like "ESG Aix en provence - ", "DIGITAL CAMPUS - Bordeaux - ", "HETIC - ", etc.
  const prefixPattern = new RegExp(
    `^${ecole.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`,
    "i"
  );
  name = name.replace(prefixPattern, "");
  // Also try stripping a city segment after the école name was removed
  if (ville) {
    const cityPrefixPattern = new RegExp(
      `^${ville.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`,
      "i"
    );
    name = name.replace(cityPrefixPattern, "");
  }
  // Fallback: if the original nomProduit starts with an ALL-CAPS word followed by " - ", strip that prefix
  if (name === nomProduit) {
    name = name.replace(/^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý\s]+?(?:\s*-\s*[A-Za-zÀ-ÿ]+)?\s*-\s*/, "");
  }

  // 2. Remove date suffixes like " - SEPTEMBRE 2026 - 2027"
  name = name.replace(/\s*-\s*[A-ZÉÈÊË]+\s+20\d{2}\s*-\s*20\d{2}$/, "");

  // 3. Remove "annee N" / "année N" patterns
  name = name.replace(/\s*-\s*(?:annee|année)\s+\d+/gi, "");
  name = name.replace(/\s*-\s*\d+(?:e|è|ème|ère)\s+année/gi, "");

  // 4. Remove duplicate consecutive segments (split on " - ")
  const segments = name.split(/\s*-\s*/);
  const deduped: string[] = [];
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    // Check if this segment is already present (case-insensitive, accent-insensitive)
    const norm = normalizeText(trimmed);
    const isDuplicate = deduped.some((prev) => {
      const prevNorm = normalizeText(prev);
      return prevNorm === norm || prevNorm.includes(norm) || norm.includes(prevNorm);
    });
    if (!isDuplicate) {
      deduped.push(trimmed);
    }
  }
  name = deduped.join(" - ");

  // 5. Trim trailing " - " and whitespace
  name = name.replace(/\s*-\s*$/, "").trim();

  return name || nomProduit;
}

/** Check if a title matches the given filters, returning the filtered formations */
function filterTitleFormations(
  title: RncpTitle,
  selectedNiveau: string | null,
  selectedVilles: string[],
  selectedDomaines: string[]
): Formation[] {
  return title.formations.filter((f) => {
    if (selectedNiveau && f.niveau !== selectedNiveau) return false;
    if (selectedVilles.length > 0 && !selectedVilles.includes(f.ville))
      return false;
    if (
      selectedDomaines.length > 0 &&
      !selectedDomaines.includes(f.domaine || "Autre")
    )
      return false;
    return true;
  });
}

/** Derive villes from filtered formations */
function deriveVilles(formations: Formation[]): string[] {
  const villeCount = new Map<string, number>();
  for (const f of formations) {
    if (f.ville) villeCount.set(f.ville, (villeCount.get(f.ville) || 0) + 1);
  }
  return Array.from(villeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}

/** Search titles by matching against blocsCompetences text.
 *  Returns an array of { title, matchingBlocs } sorted by relevance. */
interface TitleSearchResult {
  title: RncpTitle;
  matchingBlocs: BlocCompetences[];
}

function searchTitles(
  titles: RncpTitle[],
  query: string
): TitleSearchResult[] {
  const normalizedQuery = normalizeText(query.trim());
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const results: TitleSearchResult[] = [];

  for (const title of titles) {
    const intituleText = normalizeText(title.intitule);
    const intituleMatch = terms.every((t) => intituleText.includes(t));

    const matchingBlocs: BlocCompetences[] = [];
    for (const bloc of title.blocsCompetences) {
      const blocText = normalizeText(
        `${bloc.libelle} ${bloc.competences.join(" ")}`
      );
      if (terms.every((t) => blocText.includes(t))) {
        matchingBlocs.push(bloc);
      }
    }

    if (intituleMatch || matchingBlocs.length > 0) {
      results.push({ title, matchingBlocs });
    }
  }

  results.sort((a, b) => {
    if (b.matchingBlocs.length !== a.matchingBlocs.length) {
      return b.matchingBlocs.length - a.matchingBlocs.length;
    }
    return b.title.formations.length - a.title.formations.length;
  });

  return results;
}

/* ───────────────────── EcoleGroup type ───────────────────── */

interface EcoleGroup {
  ecole: string;
  villes: string[];
  rythmes: string[];
  durees: string[];
  prixMin: number;
  prixMax: number;
  formations: Formation[];
}

function buildEcoleGroups(formations: Formation[]): EcoleGroup[] {
  const map = new Map<string, Formation[]>();
  for (const f of formations) {
    const key = f.ecole || "Inconnu";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }

  const groups: EcoleGroup[] = [];
  for (const [ecole, fms] of map) {
    const villeCount = new Map<string, number>();
    const rythmeSet = new Set<string>();
    const dureeSet = new Set<string>();
    let pMin = Infinity;
    let pMax = 0;

    for (const f of fms) {
      if (f.ville) villeCount.set(f.ville, (villeCount.get(f.ville) || 0) + 1);
      if (f.rythme) rythmeSet.add(f.rythme);
      if (f.duree) dureeSet.add(f.duree);
      if (f.prix !== null && f.prix > 0) {
        if (f.prix < pMin) pMin = f.prix;
        if (f.prix > pMax) pMax = f.prix;
      }
    }
    if (pMin === Infinity) pMin = 0;

    const villes = Array.from(villeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);

    groups.push({
      ecole,
      villes,
      rythmes: Array.from(rythmeSet).sort(),
      durees: Array.from(dureeSet).sort(),
      prixMin: pMin,
      prixMax: pMax,
      formations: fms,
    });
  }

  groups.sort((a, b) => b.formations.length - a.formations.length);
  return groups;
}

/* ───────────────────────── sub-components ───────────────────────── */

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-navy text-white"
          : "border border-border bg-white text-text-secondary hover:bg-surface-alt hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function NiveauBadge({ niveau }: { niveau: string }) {
  let bg = "bg-badge-gray text-badge-gray-text";
  if (niveau.includes("3") || niveau.includes("6")) {
    bg = "bg-badge-blue-light text-badge-blue-light-text";
  }
  if (
    niveau.includes("5") ||
    niveau.includes("7") ||
    niveau.includes("8")
  ) {
    bg = "bg-badge-navy text-badge-navy-text";
  }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${bg}`}
    >
      {niveau}
    </span>
  );
}

function DropdownMultiSelect({
  label,
  items,
  selectedItems,
  onToggle,
}: {
  label: string;
  items: string[];
  selectedItems: string[];
  onToggle: (item: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = items.filter((v) => selectedItems.includes(v)).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          activeCount > 0
            ? "bg-navy text-white"
            : "border border-border bg-white text-text-secondary hover:bg-surface-alt"
        }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white/20 px-1 text-[9px]">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-20 mt-1 w-52 rounded-md border border-border bg-white shadow-lg py-1 max-h-60 overflow-y-auto custom-scrollbar">
            {items.map((v) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-alt transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.includes(v)}
                  onChange={() => onToggle(v)}
                  className="h-3.5 w-3.5 rounded border-border text-navy accent-navy"
                />
                <span className="text-text-primary">{v}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Title card for browse and search views */
function TitleCard({
  title,
  filteredFormations,
  onClick,
  matchingBloc,
}: {
  title: RncpTitle;
  filteredFormations: Formation[];
  onClick: () => void;
  matchingBloc?: BlocCompetences | null;
}) {
  const filteredVilles = deriveVilles(filteredFormations);
  const pr = (() => {
    let min = Infinity;
    let max = 0;
    for (const f of filteredFormations) {
      if (f.prix !== null && f.prix > 0) {
        if (f.prix < min) min = f.prix;
        if (f.prix > max) max = f.prix;
      }
    }
    if (min === Infinity) return "";
    if (min === max) return formatPrice(min) + " €";
    return formatPrice(min) + " – " + formatPrice(max) + " €";
  })();

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start text-left w-full rounded-md border border-border bg-white p-4 hover:border-navy/30 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between w-full gap-3">
        <p className="text-sm font-semibold text-text-primary leading-tight">
          {title.intitule}
        </p>
        {title.niveau && <NiveauBadge niveau={title.niveau} />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-text-secondary">
        <span>
          {title.blocsCompetences.length} bloc
          {title.blocsCompetences.length !== 1 ? "s" : ""} de compétences
        </span>
        {filteredVilles.length > 0 && (
          <>
            <span className="text-border">·</span>
            <span>{compactVilles(filteredVilles, 3)}</span>
          </>
        )}
        {pr && (
          <>
            <span className="text-border">·</span>
            <span className="tabular-nums">{pr}</span>
          </>
        )}
      </div>

      {/* Search result: show matching bloc */}
      {matchingBloc && (
        <div className="mt-3 w-full border-l-4 border-l-navy pl-3">
          <p className="text-xs font-medium text-text-primary">
            {matchingBloc.code} — {matchingBloc.libelle}
          </p>
          {matchingBloc.competences.slice(0, 2).map((comp, i) => (
            <p
              key={i}
              className="mt-0.5 text-xs text-text-secondary leading-relaxed"
            >
              {comp.length > 140 ? comp.slice(0, 140) + "..." : comp}
            </p>
          ))}
        </div>
      )}
    </button>
  );
}

/** Bloc accordion for title detail view */
function DetailBlocAccordion({
  bloc,
  defaultOpen,
}: {
  bloc: BlocCompetences;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-light last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-start gap-2 py-2.5 text-left text-sm hover:bg-surface-alt transition-colors rounded px-2 -mx-2"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`mt-1 shrink-0 text-navy transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
        >
          <path
            d="M4.5 2.5L8 6L4.5 9.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-text-primary">
          <span className="font-semibold text-navy">{bloc.code}</span>
          {" — "}
          {bloc.libelle}
        </span>
      </button>
      {isOpen && bloc.competences.length > 0 && (
        <ul className="ml-6 pb-3 space-y-1.5">
          {bloc.competences.map((comp, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-text-secondary"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
              {comp}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** École group card for title detail view — expandable */
function EcoleGroupCard({ group }: { group: EcoleGroup }) {
  const [expanded, setExpanded] = useState(false);
  const pr = priceRange(group.prixMin, group.prixMax);

  // Group formations by city, sorted alphabetically
  const cityGroups = useMemo(() => {
    const map = new Map<string, Formation[]>();
    for (const f of group.formations) {
      const city = f.ville || "Autre";
      if (!map.has(city)) map.set(city, []);
      map.get(city)!.push(f);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
      .map(([city, formations]) => ({
        city,
        formations: formations.sort((a, b) => {
          const dureCmp = (a.duree || "").localeCompare(b.duree || "", "fr");
          if (dureCmp !== 0) return dureCmp;
          return (a.rythme || "").localeCompare(b.rythme || "", "fr");
        }),
      }));
  }, [group.formations]);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full flex-col items-start text-left px-4 py-3 hover:bg-surface-alt/50 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3 w-full">
          <div className="flex items-start gap-2">
            <span
              className={`mt-0.5 text-xs text-navy transition-transform duration-150 inline-block ${expanded ? "rotate-90" : ""}`}
            >
              ▶
            </span>
            <p className="text-sm font-semibold text-text-primary">
              {group.ecole}
            </p>
          </div>
          {pr && (
            <span className="text-sm font-medium text-text-primary tabular-nums whitespace-nowrap">
              {pr}
            </span>
          )}
        </div>
        {group.villes.length > 0 && (
          <p className="mt-0.5 ml-5 text-xs text-text-secondary">
            {group.villes.join(" · ")}
          </p>
        )}
        {group.durees.length > 0 && (
          <div className="mt-1.5 ml-5 flex flex-wrap gap-1.5">
            {group.durees.map((d) => (
              <span
                key={d}
                className="inline-block rounded-full bg-surface-alt px-2 py-0.5 text-xs text-text-secondary"
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3 ml-5">
          {cityGroups.map(({ city, formations }) => (
            <div key={city} className="mt-2 first:mt-0">
              <p className="text-xs font-semibold text-text-secondary mb-1">
                {city}
              </p>
              <div className="space-y-0.5">
                {formations.map((f, idx) => (
                  <div
                    key={`${f.id}-${idx}`}
                    className="flex items-center justify-between text-xs text-text-secondary py-0.5 pl-2"
                  >
                    <span>
                      <span>{cleanFormationName(f.nomProduit, group.ecole, city)}</span>
                      {f.duree && (
                        <>
                          <span className="mx-1.5 text-border">&middot;</span>
                          <span>{f.duree}</span>
                        </>
                      )}
                    </span>
                    {f.prix !== null && f.prix > 0 && (
                      <span className="tabular-nums text-text-primary font-medium">
                        {formatPrice(f.prix)} €
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {city !== cityGroups[cityGroups.length - 1].city && (
                <div className="mt-2 border-t border-border-light" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Collapsible list of école groups */
function EcoleGroupList({
  formations,
}: {
  formations: Formation[];
}) {
  const groups = useMemo(() => buildEcoleGroups(formations), [formations]);

  const campusCount = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      for (const v of g.villes) {
        set.add(`${g.ecole}|${v}`);
      }
    }
    return set.size;
  }, [groups]);

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-text-secondary">
          Aucune formation disponible avec les filtres actuels.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-text-muted px-2">
          {groups.length} école{groups.length !== 1 ? "s" : ""} · {campusCount}{" "}
          campus
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="rounded-md border border-border bg-white overflow-hidden">
        {groups.map((g) => (
          <EcoleGroupCard key={g.ecole} group={g} />
        ))}
      </div>
    </div>
  );
}

/** Chevron icon */
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={`shrink-0 text-navy transition-transform duration-150 ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M5 3L9.5 7L5 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Domaine accordion section header */
function DomaineAccordion({
  name,
  titleCount,
  expanded,
  onToggle,
  children,
}: {
  name: string;
  titleCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-surface-alt transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronIcon open={expanded} />
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            {name}
          </span>
        </div>
        <span className="text-xs text-text-muted tabular-nums">
          {titleCount} titre{titleCount !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && <div className="mt-1 mb-2 space-y-2">{children}</div>}
    </div>
  );
}

/* ───────────────────────── title detail view ───────────────────────── */

function TitleDetailView({
  title,
  filteredBlocs,
  formations,
  onBack,
  onBackToDiscover,
}: {
  title: RncpTitle;
  filteredBlocs: BlocCompetences[];
  formations: Formation[];
  onBack: () => void;
  onBackToDiscover: () => void;
}) {
  const [showBlocDetail, setShowBlocDetail] = useState(false);
  const [showDebouches, setShowDebouches] = useState(false);
  const [filterVille, setFilterVille] = useState<string | null>(null);
  const [filterDuree, setFilterDuree] = useState<string | null>(null);

  const hasDebouches =
    title.secteursActivite.length > 0 || title.typesEmploi.length > 0;

  // Unique villes and durées from this title's formations
  const availableVilles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of formations) {
      if (f.ville) counts.set(f.ville, (counts.get(f.ville) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
  }, [formations]);

  const availableDurees = useMemo(() => {
    const set = new Set<string>();
    for (const f of formations) {
      if (f.duree) set.add(f.duree);
    }
    return Array.from(set).sort();
  }, [formations]);

  // Filtered formations
  const detailFilteredFormations = useMemo(() => {
    return formations.filter((f) => {
      if (filterVille && f.ville !== filterVille) return false;
      if (filterDuree && f.duree !== filterDuree) return false;
      return true;
    });
  }, [formations, filterVille, filterDuree]);

  // Truncate débouchés text for preview
  const debouchesPreview = (() => {
    const parts: string[] = [];
    if (title.typesEmploi.length > 0) {
      parts.push(title.typesEmploi.join(", "));
    }
    if (title.secteursActivite.length > 0) {
      parts.push(title.secteursActivite.join(", "));
    }
    const full = parts.join(" · ");
    if (full.length > 200) return full.slice(0, 200) + "...";
    return full;
  })();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M8.5 3L4.5 7L8.5 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Retour
          </button>
          <button
            onClick={onBackToDiscover}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            Découvrir
          </button>
        </div>

        {/* Title header */}
        <h2 className="text-xl font-bold text-text-primary leading-snug">
          {title.intitule}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary">
          <span className="font-medium">{title.numeroFiche}</span>
          {title.niveau && (
            <>
              <span className="text-border">·</span>
              <NiveauBadge niveau={title.niveau} />
            </>
          )}
          {title.niveauRncp !== null && (
            <>
              <span className="text-border">·</span>
              <span>Niveau {title.niveauRncp}</span>
            </>
          )}
          {title.domaine && (
            <>
              <span className="text-border">·</span>
              <span>{title.domaine}</span>
            </>
          )}
        </div>

        {/* ── Compétences: compact summary ── */}
        {filteredBlocs.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-text-muted px-2">
                {filteredBlocs.length} bloc{filteredBlocs.length !== 1 ? "s" : ""} de compétences
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Compact bullet list of bloc titles */}
            <ul className="space-y-1.5 mb-2">
              {filteredBlocs.map((bloc) => (
                <li
                  key={bloc.code}
                  className="flex items-start gap-2 text-sm text-text-primary"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy/40" />
                  <span>{bloc.libelle}</span>
                </li>
              ))}
            </ul>

            {/* Expand to full detail */}
            <button
              onClick={() => setShowBlocDetail(!showBlocDetail)}
              className="text-xs font-medium text-navy hover:text-navy-light transition-colors underline underline-offset-2"
            >
              {showBlocDetail ? "▲ Masquer le détail" : "▼ Voir le détail des compétences"}
            </button>

            {showBlocDetail && (
              <div className="mt-3 border-t border-border-light pt-3">
                {filteredBlocs.map((bloc, i) => (
                  <DetailBlocAccordion
                    key={bloc.code || i}
                    bloc={bloc}
                    defaultOpen={i === 0}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Formations disponibles ── */}
        <div className="mt-6">
          {/* Local filters: ville + durée */}
          {(availableVilles.length > 1 || availableDurees.length > 1) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
              {availableVilles.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">Ville</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill
                      label="Toutes"
                      active={filterVille === null}
                      onClick={() => setFilterVille(null)}
                    />
                    {availableVilles.slice(0, 5).map((v) => (
                      <Pill
                        key={v}
                        label={v}
                        active={filterVille === v}
                        onClick={() => setFilterVille(filterVille === v ? null : v)}
                      />
                    ))}
                    {availableVilles.length > 5 && (
                      <DropdownMultiSelect
                        label={`+${availableVilles.length - 5}`}
                        items={availableVilles.slice(5)}
                        selectedItems={filterVille ? [filterVille] : []}
                        onToggle={(v) => setFilterVille(filterVille === v ? null : v)}
                      />
                    )}
                  </div>
                </div>
              )}
              {availableDurees.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">Durée</span>
                  <div className="flex gap-1.5">
                    <Pill
                      label="Toutes"
                      active={filterDuree === null}
                      onClick={() => setFilterDuree(null)}
                    />
                    {availableDurees.map((d) => (
                      <Pill
                        key={d}
                        label={d}
                        active={filterDuree === d}
                        onClick={() => setFilterDuree(filterDuree === d ? null : d)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <EcoleGroupList formations={detailFilteredFormations} />
        </div>

        {/* ── Débouchés: compact with expand ── */}
        {hasDebouches && (
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-text-muted px-2">
                Débouchés
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {!showDebouches ? (
              <>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {debouchesPreview}
                </p>
                {(title.secteursActivite.join(", ") + title.typesEmploi.join(", ")).length > 200 && (
                  <button
                    onClick={() => setShowDebouches(true)}
                    className="mt-1 text-xs font-medium text-navy hover:text-navy-light transition-colors underline underline-offset-2"
                  >
                    ▼ Voir tout
                  </button>
                )}
              </>
            ) : (
              <>
                {title.secteursActivite.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-text-secondary mb-1">
                      Secteurs d'activité
                    </p>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {title.secteursActivite.join(", ")}
                    </p>
                  </div>
                )}
                {title.typesEmploi.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-text-secondary mb-1">
                      Métiers
                    </p>
                    <p className="text-sm text-text-primary leading-relaxed">
                      {title.typesEmploi.join(", ")}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setShowDebouches(false)}
                  className="mt-2 text-xs font-medium text-navy hover:text-navy-light transition-colors underline underline-offset-2"
                >
                  ▲ Réduire
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── main component ───────────────────────── */

export default function DiscoveryView({
  titles,
  formations,
  loading,
}: DiscoveryViewProps) {
  const [view, setView] = useState<ViewMode>("browse");
  const [pendingSearch, setPendingSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNiveau, setSelectedNiveau] = useState<string | null>(null);
  const [selectedVilles, setSelectedVilles] = useState<string[]>([]);
  const [selectedDomaines, setSelectedDomaines] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<RncpTitle | null>(null);
  const [expandedDomaines, setExpandedDomaines] = useState<Set<string>>(
    new Set()
  );

  /* ── derived data ── */

  // All unique niveaux and villes from the full formation list
  const { niveaux, villes } = useMemo(() => {
    const niveauxSet = new Set<string>();
    const villeCount = new Map<string, number>();
    for (const f of formations) {
      if (f.niveau) niveauxSet.add(f.niveau);
      if (f.ville) villeCount.set(f.ville, (villeCount.get(f.ville) || 0) + 1);
    }
    const sortedVilles = Array.from(villeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
    return {
      niveaux: Array.from(niveauxSet).sort(),
      villes: sortedVilles,
    };
  }, [formations]);

  const topVilles = villes.slice(0, 5);
  const otherVilles = villes.slice(5);

  // All unique domaines sorted by formation count (desc)
  const allDomaines = useMemo(() => {
    const domaineCount = new Map<string, number>();
    for (const t of titles) {
      const d = t.domaine || "Autre";
      domaineCount.set(d, (domaineCount.get(d) || 0) + t.formations.length);
    }
    return Array.from(domaineCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([d]) => d);
  }, [titles]);

  const topDomaines = allDomaines.slice(0, 6);
  const otherDomaines = allDomaines.slice(6);

  // Titles filtered by niveau/ville/domaine
  const filteredTitles = useMemo(() => {
    if (
      !selectedNiveau &&
      selectedVilles.length === 0 &&
      selectedDomaines.length === 0
    )
      return titles;
    return titles.filter((t) => {
      // Domaine filter applies at the title level
      if (
        selectedDomaines.length > 0 &&
        !selectedDomaines.includes(t.domaine || "Autre")
      )
        return false;
      // Niveau/ville filter: check if any formation passes
      const fms = filterTitleFormations(
        t,
        selectedNiveau,
        selectedVilles,
        [] // domaine already checked above
      );
      return fms.length > 0;
    });
  }, [titles, selectedNiveau, selectedVilles, selectedDomaines]);

  // Group filtered titles by domaine for browse mode
  const domaineGroups = useMemo(() => {
    const groups = new Map<string, RncpTitle[]>();
    for (const t of filteredTitles) {
      const d = t.domaine || "Autre";
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(t);
    }
    return Array.from(groups.entries())
      .map(([name, titleList]) => ({
        name,
        titles: titleList.sort(
          (a, b) => b.formations.length - a.formations.length
        ),
        formationCount: titleList.reduce(
          (sum, t) => sum + t.formations.length,
          0
        ),
      }))
      .sort((a, b) => b.formationCount - a.formationCount);
  }, [filteredTitles]);

  // Search results (driven by searchQuery, not pendingSearch)
  const searchResults = useMemo(() => {
    if (!searchQuery) return null;
    let pool = titles;
    // Apply domaine filter to the search pool
    if (selectedDomaines.length > 0) {
      pool = titles.filter((t) =>
        selectedDomaines.includes(t.domaine || "Autre")
      );
    }
    const results = searchTitles(pool, searchQuery);
    // Then apply niveau/ville filters
    if (!selectedNiveau && selectedVilles.length === 0) return results;
    return results.filter((r) => {
      const fms = filterTitleFormations(
        r.title,
        selectedNiveau,
        selectedVilles,
        []
      );
      return fms.length > 0;
    });
  }, [searchQuery, titles, selectedNiveau, selectedVilles, selectedDomaines]);

  // Group search results by domaine
  const searchDomaineGroups = useMemo(() => {
    if (!searchResults) return [];
    const groups = new Map<
      string,
      { title: RncpTitle; matchingBlocs: BlocCompetences[] }[]
    >();
    for (const r of searchResults) {
      const d = r.title.domaine || "Autre";
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(r);
    }
    return Array.from(groups.entries())
      .map(([name, results]) => ({ name, results }))
      .sort((a, b) => b.results.length - a.results.length);
  }, [searchResults]);

  // Unique domaine count for search results
  const searchDomaineCount = searchDomaineGroups.length;
  const searchTotalTitles = searchResults?.length ?? 0;

  // Formations of the selected title, filtered
  const selectedTitleFormations = useMemo(() => {
    if (!selectedTitle) return [];
    return filterTitleFormations(
      selectedTitle,
      selectedNiveau,
      selectedVilles,
      []
    );
  }, [selectedTitle, selectedNiveau, selectedVilles]);

  /* ── callbacks ── */

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPendingSearch(e.target.value);
    },
    []
  );

  const handleSearchSubmit = useCallback(() => {
    const trimmed = pendingSearch.trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    setView("search-results");
    setSelectedTitle(null);
  }, [pendingSearch]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit]
  );

  const handleClearSearch = useCallback(() => {
    setPendingSearch("");
    setSearchQuery("");
    setView("browse");
    setSelectedTitle(null);
  }, []);

  const handleSelectTitle = useCallback((title: RncpTitle) => {
    setSelectedTitle(title);
    setView("title-detail");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedTitle(null);
    if (searchQuery) {
      setView("search-results");
    } else {
      setView("browse");
    }
  }, [searchQuery]);

  const handleBackToDiscover = useCallback(() => {
    setSelectedTitle(null);
    setPendingSearch("");
    setSearchQuery("");
    setView("browse");
  }, []);

  const toggleVille = useCallback((ville: string) => {
    setSelectedVilles((prev) =>
      prev.includes(ville)
        ? prev.filter((v) => v !== ville)
        : [...prev, ville]
    );
  }, []);

  const toggleDomaine = useCallback((domaine: string) => {
    setSelectedDomaines((prev) =>
      prev.includes(domaine)
        ? prev.filter((d) => d !== domaine)
        : [...prev, domaine]
    );
  }, []);

  const toggleExpandedDomaine = useCallback((domaine: string) => {
    setExpandedDomaines((prev) => {
      const next = new Set(prev);
      if (next.has(domaine)) {
        next.delete(domaine);
      } else {
        next.add(domaine);
      }
      return next;
    });
  }, []);

  /* ── loading state ── */

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto">
          <div className="skeleton h-8 w-96 mx-auto mb-6" />
          <div className="skeleton h-10 w-full max-w-xl mx-auto mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── filter bar (shared across browse + search views) ── */

  const filterBar = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
      {/* Niveau pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Niveau</span>
        <div className="flex gap-1.5">
          <Pill
            label="Tous"
            active={selectedNiveau === null}
            onClick={() => setSelectedNiveau(null)}
          />
          {niveaux.map((n) => (
            <Pill
              key={n}
              label={n}
              active={selectedNiveau === n}
              onClick={() =>
                setSelectedNiveau(selectedNiveau === n ? null : n)
              }
            />
          ))}
        </div>
      </div>

      {/* Ville pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Ville</span>
        <div className="flex flex-wrap gap-1.5">
          <Pill
            label="Toutes"
            active={selectedVilles.length === 0}
            onClick={() => setSelectedVilles([])}
          />
          {topVilles.map((v) => (
            <Pill
              key={v}
              label={v}
              active={selectedVilles.includes(v)}
              onClick={() => toggleVille(v)}
            />
          ))}
          {otherVilles.length > 0 && (
            <DropdownMultiSelect
              label={`+${otherVilles.length}`}
              items={otherVilles}
              selectedItems={selectedVilles}
              onToggle={toggleVille}
            />
          )}
        </div>
      </div>

      {/* Domaine pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">
          Domaine
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Pill
            label="Tous"
            active={selectedDomaines.length === 0}
            onClick={() => setSelectedDomaines([])}
          />
          {topDomaines.map((d) => (
            <Pill
              key={d}
              label={d}
              active={selectedDomaines.includes(d)}
              onClick={() => toggleDomaine(d)}
            />
          ))}
          {otherDomaines.length > 0 && (
            <DropdownMultiSelect
              label={`+${otherDomaines.length}`}
              items={otherDomaines}
              selectedItems={selectedDomaines}
              onToggle={toggleDomaine}
            />
          )}
        </div>
      </div>
    </div>
  );

  /* Active tags for non-top villes / non-top domaines */
  const activeExtraTags = (() => {
    const extraVilles = selectedVilles.filter(
      (v) => !topVilles.includes(v)
    );
    const extraDomaines = selectedDomaines.filter(
      (d) => !topDomaines.includes(d)
    );
    if (extraVilles.length === 0 && extraDomaines.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1.5 mb-4">
        {extraVilles.map((v) => (
          <span
            key={`v-${v}`}
            className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-1 text-xs text-navy"
          >
            {v}
            <button
              onClick={() => toggleVille(v)}
              className="hover:text-navy-dark"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M7.5 2.5L2.5 7.5M2.5 2.5l5 5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
        {extraDomaines.map((d) => (
          <span
            key={`d-${d}`}
            className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2.5 py-1 text-xs text-navy"
          >
            {d}
            <button
              onClick={() => toggleDomaine(d)}
              className="hover:text-navy-dark"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M7.5 2.5L2.5 7.5M2.5 2.5l5 5"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
      </div>
    );
  })();

  /* ── RENDER: title-detail view ── */

  if (view === "title-detail" && selectedTitle) {
    const filteredBlocs = selectedTitle.blocsCompetences.filter(
      (bloc) => bloc.libelle && bloc.libelle.trim() !== ""
    );

    return (
      <TitleDetailView
        title={selectedTitle}
        filteredBlocs={filteredBlocs}
        formations={selectedTitleFormations}
        onBack={handleBack}
        onBackToDiscover={handleBackToDiscover}
      />
    );
  }

  /* ── RENDER: browse + search-results views ── */

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8">
        {/* Search header for browse */}
        {view === "browse" && (
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              Quelles compétences recherchez-vous ?
            </h2>
            <div className="max-w-xl mx-auto flex gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-text-muted"
                  >
                    <path
                      d="M7.25 1.5a5.75 5.75 0 1 0 3.58 10.27l2.72 2.73a.75.75 0 1 0 1.06-1.06l-2.73-2.72A5.75 5.75 0 0 0 7.25 1.5ZM3 7.25a4.25 4.25 0 1 1 8.5 0 4.25 4.25 0 0 1-8.5 0Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Ex: gestion de projet, marketing digital..."
                  className="w-full rounded-lg border border-border bg-white py-3 pl-11 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20 transition-colors"
                />
                {pendingSearch && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-text-muted hover:text-text-secondary"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleSearchSubmit}
                className="bg-navy text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-navy-light"
              >
                Rechercher
              </button>
            </div>
          </div>
        )}

        {/* Search results header */}
        {view === "search-results" && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleClearSearch}
                className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <path
                    d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span>&laquo;{searchQuery}&raquo;</span>
              </button>
            </div>
            {/* Inline search */}
            <div className="max-w-xl mb-4 flex gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-text-muted"
                  >
                    <path
                      d="M7.25 1.5a5.75 5.75 0 1 0 3.58 10.27l2.72 2.73a.75.75 0 1 0 1.06-1.06l-2.73-2.72A5.75 5.75 0 0 0 7.25 1.5ZM3 7.25a4.25 4.25 0 1 1 8.5 0 4.25 4.25 0 0 1-8.5 0Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Rechercher dans les compétences..."
                  className="w-full rounded-md border border-border bg-white py-2.5 pl-9 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/30 transition-colors"
                />
                {pendingSearch && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-secondary"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={handleSearchSubmit}
                className="bg-navy text-white rounded-md px-4 py-2.5 text-sm font-medium hover:bg-navy-light"
              >
                Rechercher
              </button>
            </div>
            <p className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary tabular-nums">
                {searchTotalTitles}
              </span>{" "}
              titre{searchTotalTitles !== 1 ? "s" : ""} dans{" "}
              <span className="font-semibold text-text-primary tabular-nums">
                {searchDomaineCount}
              </span>{" "}
              domaine{searchDomaineCount !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Filters */}
        {filterBar}
        {activeExtraTags}

        {/* ── Browse view: grouped by domaine, collapsible ── */}
        {view === "browse" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-text-muted px-2">
                {filteredTitles.length} titre
                {filteredTitles.length !== 1 ? "s" : ""} certifiant
                {filteredTitles.length !== 1 ? "s" : ""}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {domaineGroups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-text-secondary">
                  Aucun titre disponible avec les filtres actuels.
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Essayez de modifier vos filtres de niveau, de ville ou de
                  domaine.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {domaineGroups.map((group) => (
                  <DomaineAccordion
                    key={group.name}
                    name={group.name}
                    titleCount={group.titles.length}
                    expanded={expandedDomaines.has(group.name)}
                    onToggle={() => toggleExpandedDomaine(group.name)}
                  >
                    {group.titles.map((title) => {
                      const fms = filterTitleFormations(
                        title,
                        selectedNiveau,
                        selectedVilles,
                        []
                      );
                      return (
                        <TitleCard
                          key={title.numeroFiche}
                          title={title}
                          filteredFormations={
                            fms.length > 0 ? fms : title.formations
                          }
                          onClick={() => handleSelectTitle(title)}
                        />
                      );
                    })}
                  </DomaineAccordion>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Search results view: grouped by domaine ── */}
        {view === "search-results" && (
          <>
            {!searchResults || searchResults.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-text-secondary">
                  Aucun titre trouvé.
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Essayez de modifier votre recherche ou vos filtres.
                </p>
              </div>
            ) : (
              <SearchResultsGrouped
                groups={searchDomaineGroups}
                selectedNiveau={selectedNiveau}
                selectedVilles={selectedVilles}
                onSelectTitle={handleSelectTitle}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Search results grouped by domaine with accordion */
function SearchResultsGrouped({
  groups,
  selectedNiveau,
  selectedVilles,
  onSelectTitle,
}: {
  groups: {
    name: string;
    results: { title: RncpTitle; matchingBlocs: BlocCompetences[] }[];
  }[];
  selectedNiveau: string | null;
  selectedVilles: string[];
  onSelectTitle: (title: RncpTitle) => void;
}) {
  // First group expanded by default
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (groups.length > 0) return new Set([groups[0].name]);
    return new Set();
  });

  const toggleGroup = useCallback((name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <DomaineAccordion
          key={group.name}
          name={group.name}
          titleCount={group.results.length}
          expanded={expandedGroups.has(group.name)}
          onToggle={() => toggleGroup(group.name)}
        >
          {group.results.map((result) => {
            const fms = filterTitleFormations(
              result.title,
              selectedNiveau,
              selectedVilles,
              []
            );
            return (
              <TitleCard
                key={result.title.numeroFiche}
                title={result.title}
                filteredFormations={
                  fms.length > 0 ? fms : result.title.formations
                }
                onClick={() => onSelectTitle(result.title)}
                matchingBloc={result.matchingBlocs[0] ?? null}
              />
            );
          })}
        </DomaineAccordion>
      ))}
    </div>
  );
}
