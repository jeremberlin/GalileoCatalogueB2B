"use client";

import { Formation, SortConfig } from "@/types/formation";

interface ResultsTableProps {
  formations: Formation[];
  sortConfig: SortConfig | null;
  onSort: (key: keyof Formation) => void;
  onSelectFormation: (formation: Formation) => void;
  totalCount: number;
}

function SortArrow({
  column,
  sortConfig,
}: {
  column: keyof Formation;
  sortConfig: SortConfig | null;
}) {
  if (!sortConfig || sortConfig.key !== column) {
    return (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="ml-1 opacity-0 group-hover:opacity-30 transition-opacity"
      >
        <path d="M5 2L8 5H2L5 2Z" fill="currentColor" />
        <path d="M5 8L2 5H8L5 8Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className="ml-1"
    >
      {sortConfig.direction === "asc" ? (
        <path d="M5 2L8 6H2L5 2Z" fill="currentColor" />
      ) : (
        <path d="M5 8L2 4H8L5 8Z" fill="currentColor" />
      )}
    </svg>
  );
}

function NiveauBadge({ niveau }: { niveau: string }) {
  let bg = "bg-badge-gray text-badge-gray-text";
  if (niveau.includes("3") || niveau.includes("6")) {
    bg = "bg-badge-blue-light text-badge-blue-light-text";
  }
  if (niveau.includes("5") || niveau.includes("7") || niveau.includes("8")) {
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

function DomainTag({ domaine }: { domaine: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-tag-border bg-tag-bg px-2 py-0.5 text-[11px] text-tag-text leading-tight">
      {domaine}
    </span>
  );
}

function formatPrice(prix: number | null): string {
  if (prix === null || prix === 0) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(prix);
}

const formatCount = (count: number): string => {
  return new Intl.NumberFormat("fr-FR").format(count);
};

type SortableColumn = {
  key: keyof Formation;
  label: string;
  className?: string;
};

const columns: SortableColumn[] = [
  { key: "ecole", label: "École" },
  { key: "nomProduit", label: "Formation" },
  { key: "ville", label: "Ville" },
  { key: "domaine", label: "Domaine" },
  { key: "niveau", label: "Niveau" },
  { key: "duree", label: "Durée" },
  { key: "rythme", label: "Rythme" },
];

export default function ResultsTable({
  formations,
  sortConfig,
  onSort,
  onSelectFormation,
  totalCount,
}: ResultsTableProps) {
  return (
    <div>
      {/* Results count */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          <span className="font-semibold text-text-primary tabular-nums">
            {formatCount(totalCount)}
          </span>{" "}
          formation{totalCount !== 1 ? "s" : ""} trouvée
          {totalCount !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-text-secondary italic">
          Nous contacter pour devis et prix des formations
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className={`group cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors ${col.className || ""}`}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortArrow column={col.key} sortConfig={sortConfig} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {formations.map((f, idx) => (
              <tr
                key={f.id ?? idx}
                onClick={() => onSelectFormation(f)}
                className="zebra-row cursor-pointer border-b border-border-light last:border-0 hover:bg-hover-row transition-colors"
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-text-primary">
                  {f.ecole}
                </td>
                <td className="px-3 py-2.5 text-text-primary max-w-xs truncate">
                  {f.nomProduit}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                  {f.ville}
                </td>
                <td className="px-3 py-2.5">
                  {f.domaine && <DomainTag domaine={f.domaine} />}
                </td>
                <td className="px-3 py-2.5">
                  {f.niveau && <NiveauBadge niveau={f.niveau} />}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                  {f.duree}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-text-secondary">
                  {f.rythme}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div>
      <div className="mb-3">
        <div className="skeleton h-4 w-48" />
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border bg-surface px-3 py-2.5">
          <div className="flex gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-3 flex-1" />
            ))}
          </div>
        </div>
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className={`border-b border-border-light px-3 py-3 ${i % 2 === 0 ? "bg-white" : "bg-surface"}`}
          >
            <div className="flex gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <div
                  key={j}
                  className="skeleton h-3 flex-1"
                  style={{ width: `${60 + Math.random() * 40}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-text-primary">
        Aucune formation ne correspond à vos critères
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        Essayez d&#39;élargir vos filtres ou de modifier votre recherche
      </p>
    </div>
  );
}
