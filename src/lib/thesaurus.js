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

function splitThesaurusEntries(content = []) {
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
    i += 1;

    while (i < content.length && !isTermHeading(content[i])) {
      blocks.push(clone(content[i]));
      i += 1;
    }

    terms.push({ term, blocks });
  }

  return { prefix, terms };
}

function sortTermEntries(entries = []) {
  return [...entries].sort((a, b) =>
    (a.term || "").localeCompare(b.term || "", "uk", { sensitivity: "base" }),
  );
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

export function buildThesaurusTermBlocks(term, definition) {
  const safeTerm = String(term || "").trim();
  const safeDefinition = String(definition || "").trim();

  if (!safeTerm) return [];

  return [
    {
      type: "heading",
      attrs: { level: 2, id: safeTerm, textAlign: "left" },
      content: [{ type: "text", text: safeTerm }],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "left" },
      content: safeDefinition ? [{ type: "text", text: safeDefinition }] : [],
    },
  ];
}

export function upsertThesaurusTerm(content = [], term, definition) {
  const safeTerm = String(term || "").trim();
  if (!safeTerm) return sortThesaurusContent(content);

  const { prefix, terms } = splitThesaurusEntries(content);
  const normalized = safeTerm.toLocaleLowerCase("uk");

  const filtered = terms.filter(
    (entry) => (entry.term || "").toLocaleLowerCase("uk") !== normalized,
  );

  filtered.push({ term: safeTerm, blocks: buildThesaurusTermBlocks(safeTerm, definition) });

  const sorted = sortTermEntries(filtered);
  return [...prefix, ...sorted.flatMap((entry) => entry.blocks)];
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
