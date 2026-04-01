"use client";

import { useState, useEffect, useCallback } from "react";
import { Formation } from "@/types/formation";

interface FormationSheetProps {
  formation: Formation | null;
  onClose: () => void;
}

function formatPrice(prix: number | null): string {
  if (prix === null || prix === 0) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(prix);
}

function BlocAccordion({
  code,
  libelle,
  competences,
}: {
  code: string;
  libelle: string;
  competences: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

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
          className={`mt-1 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
        >
          <path
            d="M4.5 2.5L8 6L4.5 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-text-primary">
          <span className="font-semibold text-navy">{code}</span>
          {" — "}
          {libelle}
        </span>
      </button>
      {isOpen && competences.length > 0 && (
        <ul className="ml-6 pb-2 space-y-1">
          {competences.map((comp, i) => (
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

export default function FormationSheet({
  formation,
  onClose,
}: FormationSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (formation) {
      setShouldRender(true);
      // Trigger animation after render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [formation]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 280);
  }, [onClose]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (formation) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [formation, handleClose]);

  if (!shouldRender || !formation) return null;

  const f = formation;

  const details: [string, string][] = [
    ["Prix", "Nous contacter"],
    ["Rythme", f.rythme || "—"],
    ["Date début", f.dateDebut || "—"],
    ["Date fin", f.dateFin || "—"],
    ["Certificateur", f.certificateur || "—"],
    ["Code RNCP", f.codeRNCP || "—"],
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 ${isVisible ? "backdrop-active" : "backdrop-enter"}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-white shadow-xl flex flex-col
          ${isVisible ? "slide-over-active" : "slide-over-enter"}
          max-md:max-w-full`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-lg font-bold text-text-primary leading-tight">
              {f.ecole}
            </p>
            <p className="mt-1 text-base text-text-secondary leading-snug">
              {f.nomProduit}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded hover:bg-surface-alt text-text-muted hover:text-text-primary transition-colors"
            aria-label="Fermer"
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Metadata line */}
          <div className="flex items-center gap-3 px-5 py-3 text-sm text-text-secondary border-b border-border-light bg-surface">
            {f.ville && (
              <span className="flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-text-muted"
                >
                  <path
                    d="M6 1C4.067 1 2.5 2.567 2.5 4.5C2.5 7.25 6 11 6 11s3.5-3.75 3.5-6.5C9.5 2.567 7.933 1 6 1Zm0 4.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
                    fill="currentColor"
                  />
                </svg>
                {f.ville}
              </span>
            )}
            {f.duree && (
              <span className="flex items-center gap-1">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-text-muted"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="4.5"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <path
                    d="M6 3.5V6l2 1.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </svg>
                {f.duree}
              </span>
            )}
            {f.niveau && (
              <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-badge-blue-light text-badge-blue-light-text">
                {f.niveau}
              </span>
            )}
          </div>

          {/* Details table */}
          <div className="px-5 py-4">
            <table className="w-full text-sm">
              <tbody>
                {details.map(([label, value]) => (
                  <tr key={label} className="border-b border-border-light last:border-0">
                    <td className="py-2 pr-4 text-text-secondary whitespace-nowrap">
                      {label}
                    </td>
                    <td className="py-2 text-right font-medium text-text-primary tabular-nums">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Competences */}
          {f.blocsCompetences && f.blocsCompetences.length > 0 && (
            <div className="px-5 py-4 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                Compétences certifiées
              </h3>
              <div>
                {f.blocsCompetences.map((bloc, i) => (
                  <BlocAccordion
                    key={i}
                    code={bloc.code}
                    libelle={bloc.libelle}
                    competences={bloc.competences || []}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Debouches */}
          {((f.secteursActivite && f.secteursActivite.length > 0) ||
            (f.typesEmploi && f.typesEmploi.length > 0)) && (
            <div className="px-5 py-4 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">
                Débouchés
              </h3>
              {f.secteursActivite && f.secteursActivite.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-text-secondary mb-1">
                    Secteurs d&#39;activité
                  </p>
                  <p className="text-sm text-text-primary">
                    {f.secteursActivite.join(", ")}
                  </p>
                </div>
              )}
              {f.typesEmploi && f.typesEmploi.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-secondary mb-1">
                    Métiers
                  </p>
                  <p className="text-sm text-text-primary">
                    {f.typesEmploi.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
