import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// ── Column mapping ──────────────────────────────────────────────────────────
interface RawRow {
  saison: string;
  titre: string;
  rythme: string;
  session: string;
  idCataloguePrix: string;
  idEntreeCatalogue: string;
  codeProduit: string;
  nomProduit: string;
  prixCatalogue: string;
  dateDebutFormation: string | number;
  dateFinFormation: string | number;
  dureeFormation: string;
  businessUnitName: string;
}

// ── Ville extraction ────────────────────────────────────────────────────────
function extractVille(bu: string): string {
  const buTrimmed = bu.trim();

  // Exact matches first
  const exactMap: Record<string, string> = {
    BELLECOUR: "Lyon",
    HETIC: "Montreuil",
    ESGCI: "Paris",
    ESGRH: "Paris",
    ESGF: "Paris",
    "MBA ESG": "Paris",
    NARRATIIV: "Paris",
    "ITM Paris": "Paris",
    "IESA Paris": "Paris",
    "ESG Immobilier": "Paris",
    "ESG Luxe": "Paris",
    "ESG Sport": "Paris",
    "ESG Tourisme": "Paris",
    "Institut Supérieur du Vin": "Bordeaux",
  };
  if (exactMap[buTrimmed]) return exactMap[buTrimmed];

  // Pattern matches
  if (buTrimmed === "PSTB - Paris") return "Paris";
  if (buTrimmed === "PGE - PSB Paris School of Business") return "Paris";
  if (buTrimmed.startsWith("Programmes Bilingue - PSB")) return "Paris";
  if (buTrimmed === "Institut Culinaire de France - Bordeaux") return "Bordeaux";
  if (buTrimmed === "LISAA - E-learning") return "En ligne";
  if (buTrimmed === "ESARC Dijon") return "Dijon";

  // DIGITAL CAMPUS - City
  if (buTrimmed.startsWith("DIGITAL CAMPUS - ")) return buTrimmed.replace("DIGITAL CAMPUS - ", "");
  if (buTrimmed.startsWith("DIGITAL CAMPUS ")) return buTrimmed.replace("DIGITAL CAMPUS ", "");

  // LISAA - Paris - *
  if (buTrimmed.startsWith("LISAA - Paris")) return "Paris";
  // LISAA - City
  if (buTrimmed.startsWith("LISAA - ")) return buTrimmed.replace("LISAA - ", "");

  // ELIJE City
  if (buTrimmed.startsWith("ELIJE ")) return buTrimmed.replace("ELIJE ", "");

  // ESARC Evolution City
  if (buTrimmed.startsWith("ESARC Evolution ")) return buTrimmed.replace("ESARC Evolution ", "");
  if (buTrimmed.startsWith("ESARC ")) return buTrimmed.replace("ESARC ", "");

  // ESG Immobilier City, ESG Luxe City, ESG Sport City, ESG City
  for (const prefix of ["ESG Immobilier ", "ESG Luxe ", "ESG Sport ", "ESG "]) {
    if (buTrimmed.startsWith(prefix)) {
      const city = buTrimmed.replace(prefix, "");
      if (city && !/^(Immobilier|Luxe|Sport|Tourisme)$/.test(city)) return city;
    }
  }

  return "Paris"; // Default fallback
}

// ── Ecole extraction ────────────────────────────────────────────────────────
function extractEcole(bu: string): string {
  const buTrimmed = bu.trim();

  if (buTrimmed === "BELLECOUR") return "Bellecour";
  if (buTrimmed === "HETIC") return "HETIC";
  if (buTrimmed === "NARRATIIV") return "Narratiiv";
  if (buTrimmed === "ITM Paris") return "ITM";
  if (buTrimmed === "IESA Paris") return "IESA";
  if (buTrimmed === "Institut Supérieur du Vin") return "Institut Supérieur du Vin";
  if (buTrimmed.startsWith("Institut Culinaire de France")) return "Institut Culinaire de France";

  if (buTrimmed === "ESGCI" || buTrimmed === "ESGRH" || buTrimmed === "ESGF" || buTrimmed === "MBA ESG") return "ESG";
  if (buTrimmed.startsWith("ESG")) return "ESG";

  if (buTrimmed.startsWith("DIGITAL CAMPUS")) return "Digital Campus";
  if (buTrimmed.startsWith("LISAA")) return "LISAA";
  if (buTrimmed.startsWith("ESARC")) return "ESARC";
  if (buTrimmed.startsWith("ELIJE")) return "Élije";

  if (buTrimmed.startsWith("PSB") || buTrimmed.startsWith("PGE - PSB") || buTrimmed.startsWith("Programmes Bilingue - PSB")) return "PSB";
  if (buTrimmed.startsWith("PSTB")) return "PSTB";

  return buTrimmed;
}

// ── Domaine extraction ──────────────────────────────────────────────────────
function extractDomaine(nomProduit: string, titre: string, bu: string): string {
  // Strip BU name from product name to avoid false matches (e.g., "ESG Sport" matching "Sport")
  let cleanProduct = nomProduit;
  if (bu) {
    cleanProduct = cleanProduct.replace(bu, "").trim();
    // Also strip common BU prefix patterns
    cleanProduct = cleanProduct.replace(/^[\s\-]+/, "");
  }
  const text = `${cleanProduct} ${titre}`.toLowerCase();

  // Order matters — more specific before more general
  const rules: [RegExp, string][] = [
    [/culinaire|boulanger|pâtissier|patissier|arts? de la table/i, "Culinaire"],
    [/vin\b|spiritueux|vins/i, "Vin & Spiritueux"],
    [/décoration|decoration|décorateur|decorateur|architecture d'intérieur|architecture d.intérieur|architecte d.intérieur/i, "Décoration & Architecture d'intérieur"],
    [/cybersécurité|cybersecurite|cyber/i, "Tech & Informatique"],
    [/data|donnée|données|ia\b|intelligence artificielle|big data/i, "Data & IA"],
    [/développeur|developpeur|informatique|web\b|solutions? digitale|no-code|nocode/i, "Tech & Informatique"],
    [/immobilier|immobilière/i, "Immobilier"],
    [/luxe/i, "Luxe"],
    [/sport/i, "Sport"],
    [/tourisme|hébergements? touristique/i, "Tourisme"],
    [/hôtellerie|hotellerie/i, "Hôtellerie"],
    [/mode\b|fashion/i, "Mode"],
    [/audiovisuel|multimédia|multimedia/i, "Audiovisuel & Multimédia"],
    [/art\b|arts\b|culture|culturel|artistique|musique/i, "Art & Culture"],
    [/design|graphique|graphisme|direction artistique|directeur artistique/i, "Design"],
    [/banque|assurance/i, "Banque & Assurance"],
    [/logistique|transport/i, "Logistique & Transport"],
    [/ressources humaines|\brh\b/i, "Ressources Humaines"],
    [/juridique|droit|notari/i, "Juridique & Droit"],
    [/journalis/i, "Communication"],
    [/comptabilit|gestion de la pme|contrôle de gestion|audit|finance|patrimoni/i, "Finance & Gestion"],
    [/marketing|commerce|commercial|e-commerce|ecommerce|brand content|influence/i, "Marketing & Commerce"],
    [/communication|globale/i, "Communication"],
    [/digital|numérique|numerique|stratégie digitale|transformation digitale|ui\b|ux\b/i, "Digital"],
    [/management|\bmba\b|business unit|stratégie d'entreprise|programme grande école|management général|action managériale|action manageriale/i, "Management"],
    [/achats|performance achats/i, "Management"],
  ];

  for (const [regex, domaine] of rules) {
    if (regex.test(text)) return domaine;
  }

  return "Autre";
}

// ── Niveau extraction ───────────────────────────────────────────────────────
function extractNiveau(titre: string, nomProduit: string = ""): string {
  const t = (titre + " " + nomProduit).toLowerCase();
  if (t.includes("bts") || t.includes("niveau 5")) return "Bac+2";
  if (t.includes("cap")) return "CAP";
  if (t.includes("licence professionnelle")) return "Bac+3";
  if (t.includes("bachelor") || t.includes("niveau 6") || t.includes("grade_licence")) return "Bac+3";
  if (
    t.includes("mastère") ||
    t.includes("mastere") ||
    /\bmaster\b/.test(t) ||
    t.includes("niveau 7") ||
    t.includes("mba") ||
    t.includes("grade de master") ||
    t.includes("grade_master")
  )
    return "Bac+5";
  return "";
}

// ── Niveau RNCP extraction ──────────────────────────────────────────────────
function extractNiveauRncp(titre: string, nomProduit: string = ""): number | null {
  const t = (titre + " " + nomProduit).toLowerCase();
  if (t.includes("cap")) return 3;
  if (t.includes("niveau 5") || t.includes("bts")) return 5;
  if (t.includes("niveau 6") || t.includes("bachelor") || t.includes("licence professionnelle") || t.includes("grade_licence")) return 6;
  if (
    t.includes("niveau 7") ||
    t.includes("mastère") ||
    t.includes("mastere") ||
    /\bmaster\b/.test(t) ||
    t.includes("mba") ||
    t.includes("grade de master") ||
    t.includes("grade_master")
  )
    return 7;
  return null;
}

// ── Date helper ─────────────────────────────────────────────────────────────
function parseExcelDate(val: string | number): string {
  if (typeof val === "number") {
    // Excel serial date number
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  return String(val);
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const xlsxPath = path.resolve(__dirname, "..", "catalogue.xlsx");
  const outPath = path.resolve(__dirname, "..", "src", "data", "formations.json");

  console.log("Reading", xlsxPath);
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

  // Skip header
  const dataRows = rows.slice(1).filter((r) => r.length > 0 && r[0]);

  console.log(`Found ${dataRows.length} data rows`);

  const formations = dataRows.map((r, idx) => {
    const bu = String(r[12] ?? "").trim();
    const titre = String(r[1] ?? "").trim();
    const nomProduit = String(r[7] ?? "").trim();
    const prixStr = String(r[8] ?? "0").replace(/\s/g, "").replace(",", ".");
    const prix = parseFloat(prixStr) || 0;

    return {
      id: idx + 1,
      saison: String(r[0] ?? "").trim(),
      titre,
      rythme: String(r[2] ?? "").trim(),
      session: String(r[3] ?? "").trim(),
      idCataloguePrix: String(r[4] ?? "").trim(),
      idEntreeCatalogue: String(r[5] ?? "").trim(),
      codeProduit: String(r[6] ?? "").trim(),
      nomProduit,
      prixCatalogue: prix,
      dateDebutFormation: r[9] ? parseExcelDate(r[9] as string | number) : "",
      dateFinFormation: r[10] ? parseExcelDate(r[10] as string | number) : "",
      dureeFormation: String(r[11] ?? "").trim(),
      businessUnitName: bu,
      // Derived dimensions
      ville: extractVille(bu),
      ecole: extractEcole(bu),
      domaine: extractDomaine(nomProduit, titre, bu),
      niveau: extractNiveau(titre, nomProduit),
      niveauRncp: extractNiveauRncp(titre, nomProduit),
    };
  });

  // Stats
  const ecoles = new Set(formations.map((f) => f.ecole));
  const villes = new Set(formations.map((f) => f.ville));
  const domaines = new Set(formations.map((f) => f.domaine));
  const niveaux = new Set(formations.map((f) => f.niveau));

  console.log(`\n--- Stats ---`);
  console.log(`Formations: ${formations.length}`);
  console.log(`Ecoles (${ecoles.size}):`, [...ecoles].sort().join(", "));
  console.log(`Villes (${villes.size}):`, [...villes].sort().join(", "));
  console.log(`Domaines (${domaines.size}):`, [...domaines].sort().join(", "));
  console.log(`Niveaux (${niveaux.size}):`, [...niveaux].sort().join(", "));

  // Check for "Autre" domaine
  const autreFormations = formations.filter((f) => f.domaine === "Autre");
  if (autreFormations.length > 0) {
    console.log(`\n⚠ ${autreFormations.length} formations with domaine "Autre":`);
    const autreTitres = new Set(autreFormations.map((f) => f.titre));
    autreTitres.forEach((t) => console.log(`  - ${t}`));
  }

  // Check for empty niveau
  const emptyNiveau = formations.filter((f) => !f.niveau);
  if (emptyNiveau.length > 0) {
    console.log(`\n⚠ ${emptyNiveau.length} formations without niveau:`);
    const emptyTitres = new Set(emptyNiveau.map((f) => f.titre));
    emptyTitres.forEach((t) => console.log(`  - ${t}`));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(formations, null, 2), "utf-8");
  console.log(`\nWritten ${formations.length} formations to ${outPath}`);
}

main();
