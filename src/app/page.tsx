"use client";

import { useState, useEffect } from "react";
import {
  Formation,
  FormationRaw,
  RncpTitle,
  normalizeFormation,
  buildRncpTitles,
} from "@/types/formation";
import DiscoveryView from "@/components/DiscoveryView";
import CatalogueView from "@/components/CatalogueView";

type Tab = "decouvrir" | "catalogue";

export default function Home() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [titles, setTitles] = useState<RncpTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("decouvrir");

  // Load formations data
  useEffect(() => {
    async function load() {
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const res = await fetch(`${base}/formations.json`);
        if (!res.ok) throw new Error("Failed to load formations");
        const rawData: FormationRaw[] = await res.json();
        const normalized = rawData
          .filter((f) => f.rythme !== "Contrat Pro")
          .map((f) => normalizeFormation(f));
        setFormations(normalized);
        const allTitles = buildRncpTitles(normalized);
        setTitles(allTitles.filter((t) => t.blocsCompetences.length > 0));
      } catch (err) {
        console.error("Error loading formations:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-white">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-navy tracking-tight">
              Galileo
            </h1>
            <div className="hidden sm:block h-5 w-px bg-border" />
            <span className="hidden sm:block text-sm text-text-secondary">
              Catalogue Formations 2026-2027
            </span>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex px-5 gap-0 border-t border-border-light">
          <button
            onClick={() => setActiveTab("decouvrir")}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "decouvrir"
                ? "text-navy"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Découvrir
            {activeTab === "decouvrir" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("catalogue")}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "catalogue"
                ? "text-navy"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Catalogue
            {activeTab === "catalogue" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy" />
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      {activeTab === "decouvrir" ? (
        <DiscoveryView titles={titles} formations={formations} loading={loading} />
      ) : (
        <CatalogueView formations={formations} loading={loading} />
      )}
    </div>
  );
}
