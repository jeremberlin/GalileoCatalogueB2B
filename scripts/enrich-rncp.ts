import * as fs from "fs";
import * as path from "path";
import * as sax from "sax";
import { execSync } from "child_process";

// ── Types ───────────────────────────────────────────────────────────────────
interface RncpFiche {
  numeroFiche: string;
  intitule: string;
  actif: boolean;
  etatFiche: string;
  niveauEurope: string;
  certificateurs: string[];
  blocsCompetences: {
    code: string;
    libelle: string;
    competences: string;
    modalitesEvaluation: string;
  }[];
  activitesVisees: string;
  secteursActivite: string;
  typesEmploi: string;
}

interface Formation {
  id: number;
  titre: string;
  nomProduit: string;
  [key: string]: unknown;
}

// ── Strip HTML tags ─────────────────────────────────────────────────────────
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Normalize for matching ──────────────────────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Stream-parse RNCP XML using SAX ─────────────────────────────────────────
function parseRncpXml(xmlPath: string): Promise<RncpFiche[]> {
  return new Promise((resolve, reject) => {
    const fiches: RncpFiche[] = [];
    const stream = sax.createStream(true, { trim: true });

    // State tracking
    const tagStack: string[] = [];
    let currentFiche: Partial<RncpFiche> | null = null;
    let currentBloc: { code: string; libelle: string; competences: string; modalitesEvaluation: string } | null = null;
    let currentCertificateurName = "";
    let textBuffer = "";
    let inNomenclatureEurope = false;

    function currentTag(): string {
      return tagStack[tagStack.length - 1] || "";
    }

    function parentTag(): string {
      return tagStack[tagStack.length - 2] || "";
    }

    stream.on("opentag", (node) => {
      tagStack.push(node.name);
      textBuffer = "";

      if (node.name === "FICHE") {
        currentFiche = {
          numeroFiche: "",
          intitule: "",
          actif: false,
          etatFiche: "",
          niveauEurope: "",
          certificateurs: [],
          blocsCompetences: [],
          activitesVisees: "",
          secteursActivite: "",
          typesEmploi: "",
        };
      } else if (node.name === "BLOC_COMPETENCES" && currentFiche) {
        currentBloc = { code: "", libelle: "", competences: "", modalitesEvaluation: "" };
      } else if (node.name === "NOMENCLATURE_EUROPE") {
        inNomenclatureEurope = true;
      }
    });

    stream.on("text", (text) => {
      textBuffer += text;
    });

    stream.on("cdata", (cdata) => {
      textBuffer += cdata;
    });

    stream.on("closetag", (tagName) => {
      if (!currentFiche) {
        tagStack.pop();
        return;
      }

      const text = textBuffer.trim();

      if (tagName === "FICHE") {
        fiches.push(currentFiche as RncpFiche);
        if (fiches.length % 5000 === 0) {
          process.stdout.write(`  Parsed ${fiches.length} fiches...\r`);
        }
        currentFiche = null;
      } else if (tagName === "NUMERO_FICHE" && parentTag() === "FICHE") {
        currentFiche.numeroFiche = text;
      } else if (tagName === "INTITULE" && parentTag() === "FICHE") {
        currentFiche.intitule = text;
      } else if (tagName === "ACTIF") {
        currentFiche.actif = text.toLowerCase() === "oui";
      } else if (tagName === "ETAT_FICHE") {
        currentFiche.etatFiche = text;
      } else if (tagName === "NIVEAU" && inNomenclatureEurope) {
        currentFiche.niveauEurope = text;
      } else if (tagName === "NOMENCLATURE_EUROPE") {
        inNomenclatureEurope = false;
      } else if (tagName === "NOM_CERTIFICATEUR") {
        currentCertificateurName = text;
      } else if (tagName === "CERTIFICATEUR") {
        if (currentCertificateurName) {
          currentFiche.certificateurs = currentFiche.certificateurs || [];
          currentFiche.certificateurs.push(currentCertificateurName);
          currentCertificateurName = "";
        }
      } else if (currentBloc) {
        if (tagName === "CODE" && parentTag() === "BLOC_COMPETENCES") {
          currentBloc.code = text;
        } else if (tagName === "LIBELLE" && parentTag() === "BLOC_COMPETENCES") {
          currentBloc.libelle = stripHtml(text);
        } else if (tagName === "LISTE_COMPETENCES") {
          currentBloc.competences = stripHtml(text);
        } else if (tagName === "MODALITES_EVALUATION") {
          currentBloc.modalitesEvaluation = stripHtml(text);
        } else if (tagName === "BLOC_COMPETENCES") {
          currentFiche.blocsCompetences = currentFiche.blocsCompetences || [];
          currentFiche.blocsCompetences.push(currentBloc);
          currentBloc = null;
        }
      } else if (tagName === "ACTIVITES_VISEES") {
        currentFiche.activitesVisees = stripHtml(text);
      } else if (tagName === "SECTEURS_ACTIVITE") {
        currentFiche.secteursActivite = stripHtml(text);
      } else if (tagName === "TYPE_EMPLOI_ACCESSIBLES") {
        currentFiche.typesEmploi = stripHtml(text);
      }

      tagStack.pop();
      textBuffer = "";
    });

    stream.on("error", (err) => {
      reject(err);
    });

    stream.on("end", () => {
      console.log(`\nParsed ${fiches.length} RNCP fiches total`);
      resolve(fiches);
    });

    console.log("Streaming RNCP XML (this may take a moment)...");
    const readStream = fs.createReadStream(xmlPath, { encoding: "utf-8" });
    readStream.pipe(stream);
  });
}

// ── Download RNCP data ──────────────────────────────────────────────────────
async function ensureRncpXml(): Promise<string> {
  const cacheDir = path.resolve(__dirname, "..", ".cache");
  const xmlPath = path.join(cacheDir, "export_fiches_rncp.xml");

  if (fs.existsSync(xmlPath)) {
    console.log("Using cached RNCP XML file");
    return xmlPath;
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  console.log("Fetching RNCP dataset info from data.gouv.fr API...");
  const datasetResp = await fetch(
    "https://www.data.gouv.fr/api/1/datasets/repertoire-national-des-certifications-professionnelles-et-repertoire-specifique/"
  );
  const dataset = (await datasetResp.json()) as {
    resources: { title: string; url: string }[];
  };

  const rncpResource = dataset.resources.find(
    (r) =>
      (r.title.toLowerCase().includes("export-fiches-rncp") || r.url.toLowerCase().includes("export-fiches-rncp")) &&
      (r.title.endsWith(".zip") || r.url.endsWith(".zip"))
  );

  if (!rncpResource) {
    console.log("Available resources:");
    dataset.resources.forEach((r) => console.log(`  - ${r.title}: ${r.url}`));
    throw new Error("Could not find RNCP export ZIP resource");
  }

  console.log(`Found resource: ${rncpResource.title}`);
  const zipPath = path.join(cacheDir, "rncp.zip");

  console.log(`Downloading from: ${rncpResource.url}`);
  execSync(`curl -L -o "${zipPath}" "${rncpResource.url}"`, {
    stdio: "inherit",
    timeout: 300000,
  });

  console.log("Extracting ZIP...");
  execSync(`unzip -o "${zipPath}" -d "${cacheDir}"`, { stdio: "inherit" });

  const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith(".xml"));
  if (files.length === 0) throw new Error("No XML file found in ZIP");

  const extractedXml = path.join(cacheDir, files[0]);
  if (extractedXml !== xmlPath) {
    fs.renameSync(extractedXml, xmlPath);
  }

  fs.unlinkSync(zipPath);
  console.log("RNCP XML extracted successfully");
  return xmlPath;
}

// ── Extract search terms from our catalogue title ───────────────────────────
function extractSearchTerms(titreOriginal: string): { certName: string; specialty: string; certHint: string } {
  const parts = titreOriginal.split(" - ");

  // BTS format: "BTS - Specialty - Certificateur - ..."
  if (parts[0].trim().startsWith("BTS") && parts.length > 1) {
    // For "BTS - Communication - Ministere..." the specialty is parts[1]
    // For "BTS Banque - Ministere..." the specialty is in parts[0] after "BTS "
    const first = parts[0].trim();
    if (first === "BTS" && parts.length > 1) {
      return { certName: first, specialty: parts[1].trim(), certHint: parts.slice(2).join(" ") };
    }
    // "BTS Banque" -> specialty = "Banque"
    const specFromFirst = first.replace(/^BTS\s+/, "").trim();
    return { certName: first, specialty: specFromFirst, certHint: parts.slice(1).join(" ") };
  }

  // Licence Professionnelle format: "Licence Professionnelle - Specialty - Certificateur"
  // or "Licence Professionnelle Specialty : detail - Certificateur"
  if (parts[0].trim().startsWith("Licence Professionnelle")) {
    const first = parts[0].trim();
    if (first === "Licence Professionnelle" && parts.length > 1) {
      return { certName: first, specialty: parts[1].trim(), certHint: parts.slice(2).join(" ") };
    }
    // "Licence Professionnelle Métiers de la gestion..." - specialty is everything after "Licence Professionnelle "
    const specFromFirst = first.replace(/^Licence Professionnelle\s+/, "").trim();
    return { certName: "Licence Professionnelle", specialty: specFromFirst, certHint: parts.slice(1).join(" ") };
  }

  // "Grade_Licence - Diplome de comptabilite..." or "Grade_Master - Diplome superieur..."
  if (parts[0].trim().startsWith("Grade_") && parts.length > 1) {
    // The actual diploma name is in parts[1]
    return { certName: parts[1].trim(), specialty: "", certHint: parts.slice(2).join(" ") };
  }

  // Standard: "CertName - Certificateur - Niveau X"
  return { certName: parts[0].trim(), specialty: "", certHint: parts.slice(1).join(" ") };
}

// ── Match titles to RNCP fiches ─────────────────────────────────────────────
function findBestMatch(titreOriginal: string, rncpFiches: RncpFiche[]): RncpFiche | null {
  const { certName, specialty, certHint } = extractSearchTerms(titreOriginal);

  const normalizedCertName = normalize(certName);
  const normalizedSpecialty = normalize(specialty);

  // For BTS: match on specialty name (RNCP stores without "BTS" prefix usually)
  if (certName.startsWith("BTS") || certName === "BTS") {
    const searchTerm = normalizedSpecialty || normalizedCertName.replace(/^bts\s*/, "");

    // Try exact match on specialty
    let candidates = rncpFiches.filter((f) => {
      const ni = normalize(f.intitule);
      return ni === searchTerm;
    });

    // Try intitule contains specialty
    if (candidates.length === 0) {
      candidates = rncpFiches.filter((f) => {
        const ni = normalize(f.intitule);
        return ni.includes(searchTerm) || searchTerm.includes(ni);
      });
    }

    // Try word overlap
    if (candidates.length === 0) {
      const words = searchTerm.split(" ").filter((w) => w.length > 3);
      if (words.length > 0) {
        candidates = rncpFiches.filter((f) => {
          const ni = normalize(f.intitule);
          const matchCount = words.filter((w) => ni.includes(w)).length;
          return matchCount >= Math.max(1, Math.ceil(words.length * 0.6));
        });
      }
    }

    return selectBest(candidates, searchTerm, certHint);
  }

  // For Licence Professionnelle: match on specialty
  if (certName.startsWith("Licence Professionnelle")) {
    const searchTerm = normalizedSpecialty;

    let candidates = rncpFiches.filter((f) => {
      const ni = normalize(f.intitule);
      return ni.includes(searchTerm) || searchTerm.includes(ni);
    });

    if (candidates.length === 0) {
      const words = searchTerm.split(" ").filter((w) => w.length > 3);
      if (words.length > 0) {
        candidates = rncpFiches.filter((f) => {
          const ni = normalize(f.intitule);
          const matchCount = words.filter((w) => ni.includes(w)).length;
          return matchCount >= Math.max(1, Math.ceil(words.length * 0.5));
        });
      }
    }

    return selectBest(candidates, searchTerm, certHint);
  }

  // Standard matching for other titles
  const normalizedSearch = normalizedCertName;

  // First pass: exact normalized match
  let candidates = rncpFiches.filter((f) => normalize(f.intitule) === normalizedSearch);

  // Second pass: containment
  if (candidates.length === 0) {
    candidates = rncpFiches.filter((f) => {
      const ni = normalize(f.intitule);
      return ni.includes(normalizedSearch) || normalizedSearch.includes(ni);
    });
  }

  // Third pass: word overlap (60%)
  if (candidates.length === 0) {
    const certWords = normalizedSearch.split(" ").filter((w) => w.length > 3);
    if (certWords.length > 0) {
      candidates = rncpFiches.filter((f) => {
        const ni = normalize(f.intitule);
        const matchCount = certWords.filter((w) => ni.includes(w)).length;
        return matchCount >= Math.ceil(certWords.length * 0.6);
      });
    }
  }

  return selectBest(candidates, normalizedSearch, certHint);
}

function selectBest(candidates: RncpFiche[], searchTerm: string, certHint: string): RncpFiche | null {
  if (candidates.length === 0) return null;

  // If certificateur hint available, prefer matches with that certificateur
  if (certHint) {
    const normalizedHint = normalize(certHint);
    const hintWords = normalizedHint.split(" ").filter((w) => w.length > 3);
    const withCert = candidates.filter((f) =>
      f.certificateurs.some((c) => {
        const nc = normalize(c);
        return hintWords.some((w) => nc.includes(w));
      })
    );
    if (withCert.length > 0) candidates = withCert;
  }

  // Prefer active + published fiches
  const active = candidates.filter((f) => f.actif && f.etatFiche === "Publiee");
  if (active.length > 0) candidates = active;

  // Sort by intitule closeness to search term
  candidates.sort((a, b) => {
    const da = Math.abs(normalize(a.intitule).length - searchTerm.length);
    const db = Math.abs(normalize(b.intitule).length - searchTerm.length);
    return da - db;
  });

  return candidates[0] || null;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const formationsPath = path.resolve(__dirname, "..", "src", "data", "formations.json");

  if (!fs.existsSync(formationsPath)) {
    console.error("formations.json not found. Run build:data first.");
    process.exit(1);
  }

  const formations: Formation[] = JSON.parse(fs.readFileSync(formationsPath, "utf-8"));
  console.log(`Loaded ${formations.length} formations`);

  // Get unique titles
  const uniqueTitres = [...new Set(formations.map((f) => f.titre))].filter(Boolean);
  console.log(`Found ${uniqueTitres.length} unique titles to match`);

  // Download and parse RNCP data
  const xmlPath = await ensureRncpXml();
  const rncpFiches = await parseRncpXml(xmlPath);

  // Match each unique title
  const matchResults: Record<string, RncpFiche | null> = {};
  let matched = 0;
  let unmatched = 0;

  console.log("\n--- Matching titles ---");
  for (const titre of uniqueTitres) {
    const match = findBestMatch(titre, rncpFiches);
    matchResults[titre] = match;
    if (match) {
      matched++;
      console.log(`  OK "${titre.substring(0, 60)}..." -> ${match.numeroFiche} (${match.intitule.substring(0, 50)})`);
    } else {
      unmatched++;
      console.log(`  XX "${titre.substring(0, 80)}..." -> No match`);
    }
  }

  console.log(`\n--- RNCP Matching Results ---`);
  console.log(`Matched: ${matched}/${uniqueTitres.length}`);
  console.log(`Unmatched: ${unmatched}/${uniqueTitres.length}`);

  if (unmatched > 0) {
    console.log(`\nUnmatched titles:`);
    for (const titre of uniqueTitres) {
      if (!matchResults[titre]) {
        console.log(`  - ${titre}`);
      }
    }
  }

  // Enrich formations
  const enrichedFormations = formations.map((f) => {
    const match = matchResults[f.titre];
    if (match) {
      return {
        ...f,
        rncp: {
          numeroFiche: match.numeroFiche,
          intitule: match.intitule,
          blocsCompetences: match.blocsCompetences,
          activitesVisees: match.activitesVisees,
          secteursActivite: match.secteursActivite,
          typesEmploi: match.typesEmploi,
        },
      };
    }
    return { ...f, rncp: null };
  });

  const enrichedCount = enrichedFormations.filter((f) => f.rncp).length;
  console.log(`\nEnriched ${enrichedCount}/${formations.length} formations with RNCP data`);

  fs.writeFileSync(formationsPath, JSON.stringify(enrichedFormations, null, 2), "utf-8");
  console.log(`Written enriched data to ${formationsPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
