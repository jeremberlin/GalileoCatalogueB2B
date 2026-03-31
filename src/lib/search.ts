import MiniSearch from "minisearch";
import { Formation } from "@/types/formation";

let searchIndex: MiniSearch<Formation> | null = null;

export function buildSearchIndex(formations: Formation[]): MiniSearch<Formation> {
  const index = new MiniSearch<Formation>({
    fields: [
      "nomProduit",
      "ecole",
      "ville",
      "domaine",
      "certificateur",
      "competencesText",
    ],
    storeFields: ["id"],
    searchOptions: {
      boost: {
        nomProduit: 3,
        ecole: 2,
        domaine: 1.5,
        ville: 1.2,
        competencesText: 0.8,
      },
      fuzzy: 0.2,
      prefix: true,
    },
    tokenize: (text: string) => {
      // Custom tokenizer that handles French accents and compound words
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks for matching
        .split(/[\s\-_/,;:.()+]+/)
        .filter((t) => t.length > 1);
    },
  });

  // Prepare documents with flattened competences text
  const docs = formations.map((f) => ({
    ...f,
    competencesText: flattenCompetences(f),
  }));

  index.addAll(docs);
  searchIndex = index;
  return index;
}

function flattenCompetences(formation: Formation): string {
  if (!formation.blocsCompetences || formation.blocsCompetences.length === 0) {
    return "";
  }
  return formation.blocsCompetences
    .map((bloc) => {
      const competencesStr = bloc.competences ? bloc.competences.join(" ") : "";
      return `${bloc.code} ${bloc.libelle} ${competencesStr}`;
    })
    .join(" ");
}

export function searchFormations(
  query: string,
  formations: Formation[],
  index: MiniSearch<Formation>
): Formation[] {
  if (!query || query.trim().length === 0) {
    return formations;
  }

  const results = index.search(query.trim());
  const idSet = new Set(results.map((r) => r.id));
  return formations.filter((f) => idSet.has(f.id));
}

export function getSearchIndex(): MiniSearch<Formation> | null {
  return searchIndex;
}
