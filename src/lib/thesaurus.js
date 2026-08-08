export const THESAURUS_BOOK_NAME = "thesaurus";
export const THESAURUS_BOOK_LABEL = "Тезаурус";
export const THESAURUS_DEFAULT_SECTION = "terms";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text || "";
  if (!Array.isArray(node.content)) return "";
  return node.content.map(extractText).join("");
}

function isTermHeading(block) {
  return block?.type === "heading" && block?.attrs?.level === 2;
}

function normalizeSynonyms(rawSynonyms) {
  const list = Array.isArray(rawSynonyms)
    ? rawSynonyms
    : String(rawSynonyms || "")
      .split(",")
      .map((item) => item.trim());

  const seen = new Set();
  const normalized = [];

  for (const item of list) {
    const value = String(item || "").trim();
    if (!value) continue;

    const key = value.toLocaleLowerCase("uk");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export function splitThesaurusEntries(content = []) {
  const prefix = [];
  const terms = [];

  let i = 0;
  while (i < content.length) {
    const current = content[i];

    if (!isTermHeading(current)) {
      prefix.push(clone(current));
      i += 1;
      continue;
    }

    const blocks = [clone(current)];
    const term = extractText(current).trim();
    const synonyms = normalizeSynonyms(current?.attrs?.synonyms);
    i += 1;

    while (i < content.length && !isTermHeading(content[i])) {
      blocks.push(clone(content[i]));
      i += 1;
    }

    terms.push({ term, blocks, synonyms });
  }

  return { prefix, terms };
}

function sortTermEntries(entries = []) {
  return [...entries].sort((a, b) =>
    (a.term || "").localeCompare(b.term || "", "uk", { sensitivity: "base" }),
  );
}

export function getThesaurusEntries(content = []) {
  return splitThesaurusEntries(content);
}

export function getThesaurusTerms(content = []) {
  const { terms } = splitThesaurusEntries(content);
  return sortTermEntries(terms)
    .map((entry) => entry.term)
    .filter(Boolean);
}

export function sortThesaurusContent(content = []) {
  const { prefix, terms } = splitThesaurusEntries(content);
  const sortedTerms = sortTermEntries(terms);
  return [...prefix, ...sortedTerms.flatMap((entry) => entry.blocks)];
}

export function filterThesaurusContentByPrefix(content = [], query = "") {
  const { prefix, entries } = findThesaurusEntriesByPrefix(content, query);
  return [...prefix, ...entries.flatMap((entry) => entry.blocks)];
}

export function findThesaurusEntriesByPrefix(content = [], query = "") {
  const normalized = String(query || "").trim().toLocaleLowerCase("uk");
  const { prefix, terms } = splitThesaurusEntries(content);
  const sortedTerms = sortTermEntries(terms);

  if (!normalized) {
    return {
      prefix,
      entries: sortedTerms.map((entry) => ({
        ...entry,
        matchedBy: null,
        matchedSynonym: "",
      })),
    };
  }

  const filtered = sortedTerms
    .map((entry) => {
      const termMatch = String(entry.term || "")
        .toLocaleLowerCase("uk")
        .startsWith(normalized);

      const synonymMatch = (entry.synonyms || []).find((synonym) =>
        String(synonym || "").toLocaleLowerCase("uk").startsWith(normalized),
      );

      if (!termMatch && !synonymMatch) return null;

      return {
        ...entry,
        matchedBy: termMatch ? "term" : "synonym",
        matchedSynonym: termMatch ? "" : synonymMatch || "",
      };
    })
    .filter(Boolean);

  return { prefix, entries: filtered };
}

function buildEmptyDefinitionBlock() {
  return [{ type: "paragraph", attrs: { textAlign: "left" }, content: [] }];
}

export function buildThesaurusTermBlocks(term, definitionOrBlocks = "", options = {}) {
  const safeTerm = String(term || "").trim();
  const synonyms = normalizeSynonyms(options?.synonyms);

  if (!safeTerm) return [];

  const bodyBlocks = Array.isArray(definitionOrBlocks)
    ? definitionOrBlocks.map(clone)
    : String(definitionOrBlocks || "").trim()
      ? [{ type: "paragraph", attrs: { textAlign: "left" }, content: [{ type: "text", text: String(definitionOrBlocks).trim() }] }]
      : buildEmptyDefinitionBlock();

  return [
    {
      type: "heading",
      attrs: {
        level: 2,
        id: safeTerm,
        textAlign: "left",
        synonyms,
      },
      content: [{ type: "text", text: safeTerm }],
    },
    ...bodyBlocks,
  ];
}

export function upsertThesaurusTermBlocks(content = [], term, blocks = []) {
  const safeTerm = String(term || "").trim();
  if (!safeTerm) return sortThesaurusContent(content);

  const { prefix, terms } = splitThesaurusEntries(content);
  const normalized = safeTerm.toLocaleLowerCase("uk");

  const filtered = terms.filter(
    (entry) => (entry.term || "").toLocaleLowerCase("uk") !== normalized,
  );

  const normalizedBlocks = Array.isArray(blocks) && blocks.length
    ? blocks.map(clone)
    : buildThesaurusTermBlocks(safeTerm, "");

  filtered.push({ term: safeTerm, blocks: normalizedBlocks });

  const sorted = sortTermEntries(filtered);
  return [...prefix, ...sorted.flatMap((entry) => entry.blocks)];
}

export function upsertThesaurusTerm(content = [], term, definition) {
  const safeTerm = String(term || "").trim();
  if (!safeTerm) return sortThesaurusContent(content);

  return upsertThesaurusTermBlocks(content, safeTerm, buildThesaurusTermBlocks(safeTerm, definition));
}

export function removeThesaurusTerm(content = [], term) {
  const safeTerm = String(term || "").trim();
  if (!safeTerm) return sortThesaurusContent(content);

  const { prefix, terms } = splitThesaurusEntries(content);
  const normalized = safeTerm.toLocaleLowerCase("uk");

  const filtered = terms.filter(
    (entry) => (entry.term || "").toLocaleLowerCase("uk") !== normalized,
  );

  const sorted = sortTermEntries(filtered);
  return [...prefix, ...sorted.flatMap((entry) => entry.blocks)];
}
