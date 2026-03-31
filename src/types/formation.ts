export interface BlocCompetencesRaw {
  code: string;
  libelle: string;
  competences: string;
  modalitesEvaluation?: string;
}

export interface BlocCompetences {
  code: string;
  libelle: string;
  competences: string[];
}

export interface RncpDataRaw {
  numeroFiche: string;
  intitule: string;
  blocsCompetences: BlocCompetencesRaw[];
  activitesVisees: string;
  secteursActivite: string;
  typesEmploi: string;
}

/**
 * Formation data as loaded from formations.json.
 * RNCP data is nested under the `rncp` key.
 */
export interface FormationRaw {
  id: number;
  saison: string;
  titre: string;
  rythme: string;
  session: string;
  idCataloguePrix: string;
  idEntreeCatalogue: string;
  codeProduit: string;
  nomProduit: string;
  prixCatalogue: number | null;
  dateDebutFormation: string;
  dateFinFormation: string;
  dureeFormation: string;
  businessUnitName: string;
  ville: string;
  ecole: string;
  domaine: string;
  niveau: string;
  niveauRncp: number | null;
  rncp: RncpDataRaw | null;
}

/**
 * Normalized formation for the UI.
 */
export interface Formation {
  id: string;
  nomProduit: string;
  ecole: string;
  ville: string;
  domaine: string;
  niveau: string;
  duree: string;
  rythme: string;
  prix: number | null;
  prixLabel: string;
  dateDebut: string;
  dateFin: string;
  certificateur: string;
  codeRNCP: string;
  intituleRncp: string;
  blocsCompetences: BlocCompetences[];
  secteursActivite: string[];
  typesEmploi: string[];
  titre: string;
}

/**
 * An RNCP title groups all formations that share the same RNCP code.
 * This is the primary navigation entity in the Discovery view.
 */
export interface RncpTitle {
  numeroFiche: string;
  intitule: string;
  niveau: string;
  niveauRncp: number | null;
  domaine: string;
  blocsCompetences: BlocCompetences[];
  secteursActivite: string[];
  typesEmploi: string[];
  certificateur: string;
  formations: Formation[];
  ecoles: string[];
  villes: string[];
  prixMin: number;
  prixMax: number;
}

/**
 * Split a long French text string into individual items.
 * The JSON uses four-space sequences ("    ") as delimiters.
 * Falls back to splitting on ". " followed by an uppercase letter if no
 * four-space delimiter is found.
 */
function splitTextToItems(text: string): string[] {
  if (!text) return [];

  // Primary delimiter: four consecutive spaces
  if (text.includes("    ")) {
    return text
      .split("    ")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Fallback: split on period followed by whitespace and an uppercase letter
  const parts = text.split(/\.(?=\s+[A-ZÀ-Ö])/);
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : s + "."));
}

/**
 * Extract the certificateur from the titre field.
 * Titre format: "Intitulé - Certificateur (sigle) - Niveau X"
 */
function extractCertificateur(titre: string): string {
  if (!titre) return "";
  const parts = titre.split(" - ");
  // At least 3 parts expected: title, certificateur, niveau
  if (parts.length >= 3) {
    return parts[1].trim();
  }
  // If only 2 parts, the second might be the certificateur
  if (parts.length === 2) {
    return parts[1].trim();
  }
  return "";
}

export function normalizeFormation(raw: FormationRaw): Formation {
  const rncp = raw.rncp;

  const blocsCompetencesMapped: BlocCompetences[] = (rncp?.blocsCompetences ?? []).map(
    (bloc) => ({
      code: bloc.code,
      libelle: bloc.libelle,
      competences: splitTextToItems(bloc.competences),
    })
  );

  // Filter out ghost/empty blocs: must have a non-empty libelle AND at least one competence
  const blocsFiltered = blocsCompetencesMapped.filter(
    (bloc) => bloc.libelle && bloc.competences.length > 0
  );

  // Deduplicate by code — keep the bloc with the most competences
  const blocsByCode = new Map<string, BlocCompetences>();
  for (const bloc of blocsFiltered) {
    const existing = blocsByCode.get(bloc.code);
    if (!existing || bloc.competences.length > existing.competences.length) {
      blocsByCode.set(bloc.code, bloc);
    }
  }
  const blocsCompetences = Array.from(blocsByCode.values());

  const secteursActivite = splitTextToItems(rncp?.secteursActivite ?? "");
  const typesEmploi = splitTextToItems(rncp?.typesEmploi ?? "");
  const codeRNCP = rncp?.numeroFiche ?? "";
  const certificateur = extractCertificateur(raw.titre);

  return {
    id: String(raw.id),
    nomProduit: raw.nomProduit || raw.titre || "",
    ecole: raw.ecole || raw.businessUnitName || "",
    ville: raw.ville || "",
    domaine: raw.domaine || "",
    niveau: raw.niveau || "",
    duree: raw.dureeFormation || "",
    rythme: raw.rythme || "",
    prix: raw.prixCatalogue ?? null,
    prixLabel: raw.prixCatalogue
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(raw.prixCatalogue)
      : "",
    dateDebut: formatDateFr(raw.dateDebutFormation),
    dateFin: formatDateFr(raw.dateFinFormation),
    certificateur,
    codeRNCP,
    intituleRncp: rncp?.intitule ?? "",
    blocsCompetences,
    secteursActivite,
    typesEmploi,
    titre: raw.titre || "",
  };
}

/** Find the most frequent value in an array of strings. */
function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build RncpTitle objects by grouping formations that share the same codeRNCP.
 * Formations with an empty codeRNCP are excluded.
 * The returned array is sorted by number of formations descending.
 */
export function buildRncpTitles(formations: Formation[]): RncpTitle[] {
  const groups = new Map<string, Formation[]>();

  for (const f of formations) {
    if (!f.codeRNCP) continue;
    const key = f.codeRNCP;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(f);
  }

  const titles: RncpTitle[] = [];

  for (const [code, fms] of groups) {
    // intitule: from the first formation that has one
    const intitule = fms.find((f) => f.intituleRncp)?.intituleRncp ?? fms[0].nomProduit;

    // niveau: most common among formations
    const niveau = mostCommon(fms.map((f) => f.niveau));

    // niveauRncp: from the raw data — stored on FormationRaw but not on Formation.
    // We parse it from the titre field or use null. The codeRNCP prefix can hint:
    // RNCP titles at Bac+3 are typically niveau 6, Bac+5 niveau 7, Bac+2 niveau 5.
    let niveauRncp: number | null = null;
    if (niveau.includes("2")) niveauRncp = 5;
    else if (niveau.includes("3")) niveauRncp = 6;
    else if (niveau.includes("5")) niveauRncp = 7;

    // domaine: most common
    const domaine = mostCommon(fms.map((f) => f.domaine));

    // blocsCompetences: gather from all formations, then filter to only blocs
    // belonging to this title's own RNCP number (e.g. for RNCP40601, keep only
    // blocs whose code starts with "RNCP40601"). This removes ghost blocs
    // inherited from linked RNCP fiches like RNCP34509, RNCP36914, etc.
    const allBlocs = fms.flatMap((f) => f.blocsCompetences);
    const ownBlocs = allBlocs.filter(
      (bloc) => bloc.code.startsWith(code) && bloc.libelle && bloc.competences.length > 0
    );
    // Deduplicate by code — keep the bloc with the most competences
    const titleBlocsByCode = new Map<string, BlocCompetences>();
    for (const bloc of ownBlocs) {
      const existing = titleBlocsByCode.get(bloc.code);
      if (!existing || bloc.competences.length > existing.competences.length) {
        titleBlocsByCode.set(bloc.code, bloc);
      }
    }
    const blocsCompetences = Array.from(titleBlocsByCode.values());

    // secteursActivite, typesEmploi: from the first formation that has them
    const secteursActivite = fms.find((f) => f.secteursActivite.length > 0)?.secteursActivite ?? [];
    const typesEmploi = fms.find((f) => f.typesEmploi.length > 0)?.typesEmploi ?? [];

    // certificateur: from first formation
    const certificateur = fms.find((f) => f.certificateur)?.certificateur ?? "";

    // ecoles: unique, sorted alphabetically
    const ecoles = Array.from(new Set(fms.map((f) => f.ecole).filter(Boolean))).sort();

    // villes: unique, sorted by frequency (most formations first)
    const villeCount = new Map<string, number>();
    for (const f of fms) {
      if (f.ville) {
        villeCount.set(f.ville, (villeCount.get(f.ville) || 0) + 1);
      }
    }
    const villes = Array.from(villeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);

    // prixMin / prixMax
    let prixMin = Infinity;
    let prixMax = 0;
    for (const f of fms) {
      if (f.prix !== null && f.prix > 0) {
        if (f.prix < prixMin) prixMin = f.prix;
        if (f.prix > prixMax) prixMax = f.prix;
      }
    }
    if (prixMin === Infinity) prixMin = 0;

    titles.push({
      numeroFiche: code,
      intitule,
      niveau,
      niveauRncp,
      domaine,
      blocsCompetences,
      secteursActivite,
      typesEmploi,
      certificateur,
      formations: fms,
      ecoles,
      villes,
      prixMin,
      prixMax,
    });
  }

  // Sort by number of formations descending
  titles.sort((a, b) => b.formations.length - a.formations.length);
  return titles;
}

function formatDateFr(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const months = [
      "Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin",
      "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc.",
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export interface SortConfig {
  key: keyof Formation;
  direction: "asc" | "desc";
}

export interface ActiveFilters {
  ecole: string[];
  ville: string[];
  domaine: string[];
  niveau: string[];
  duree: string[];
  rythme: string[];
  prixMin: number | null;
  prixMax: number | null;
}

export const emptyFilters: ActiveFilters = {
  ecole: [],
  ville: [],
  domaine: [],
  niveau: [],
  duree: [],
  rythme: [],
  prixMin: null,
  prixMax: null,
};

export type FilterCategory = "ecole" | "ville" | "domaine" | "niveau" | "duree" | "rythme";
