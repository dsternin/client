import { Extension } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const grammarHighlightKey = new PluginKey("grammarHighlight");

function overlaps(from, to, changedFrom, changedTo) {
  if (changedFrom === changedTo) {
    return changedFrom >= from && changedFrom <= to;
  }
  return changedFrom < to && changedTo > from;
}

function mapRanges(ranges, mapping) {
  let mappedRanges = ranges;

  for (const stepMap of mapping.maps) {
    const changedRanges = [];
    stepMap.forEach((from, to) => changedRanges.push({ from, to }));

    mappedRanges = mappedRanges.flatMap((range) => {
      if (
        changedRanges.some((changed) =>
          overlaps(range.from, range.to, changed.from, changed.to),
        )
      ) {
        return [];
      }

      const from = stepMap.mapResult(range.from, 1);
      const to = stepMap.mapResult(range.to, -1);
      if (from.deleted || to.deleted || to.pos <= from.pos) return [];

      return [{ ...range, from: from.pos, to: to.pos }];
    });
  }

  return mappedRanges;
}

export function getGrammarHighlightState(state) {
  return grammarHighlightKey.getState(state);
}

function createDecorations(doc, matches) {
  return DecorationSet.create(
    doc,
    matches
      .filter(
        (match) =>
          Number.isInteger(match.from) &&
          Number.isInteger(match.to) &&
          match.from >= 0 &&
          match.to > match.from &&
          match.to <= doc.content.size,
      )
      .map((match) =>
        Decoration.inline(
          match.from,
          match.to,
          {
            class: "grammar-error",
            "data-grammar-issue": String(match.id),
          },
          { inclusive: false },
        ),
      ),
  );
}

const GrammarHighlight = Extension.create({
  name: "grammarHighlight",

  addCommands() {
    return {
      setGrammarData:
        ({ matches, checkedRanges }) =>
        ({ tr, dispatch }) => {
          dispatch?.(
            tr.setMeta(grammarHighlightKey, {
              type: "set",
              matches,
              checkedRanges,
            }),
          );
          return true;
        },
      invalidateGrammarRanges:
        (ranges) =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(grammarHighlightKey, { type: "invalidate", ranges }));
          return true;
        },
      clearGrammarHighlights:
        () =>
        ({ tr, dispatch }) => {
          dispatch?.(
            tr.setMeta(grammarHighlightKey, {
              type: "set",
              matches: [],
              checkedRanges: [],
            }),
          );
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: grammarHighlightKey,
        state: {
          init: () => ({
            matches: [],
            checkedRanges: [],
            decorations: DecorationSet.empty,
          }),
          apply(tr, pluginState) {
            const meta = tr.getMeta(grammarHighlightKey);
            if (meta?.type === "set") {
              const matches = meta.matches || [];
              const checkedRanges = meta.checkedRanges || [];
              return {
                matches,
                checkedRanges,
                decorations: createDecorations(tr.doc, matches),
              };
            }

            if (meta?.type === "invalidate") {
              const invalidRanges = meta.ranges || [];
              const matches = pluginState.matches.filter(
                (match) =>
                  !invalidRanges.some((invalid) =>
                    overlaps(match.from, match.to, invalid.from, invalid.to),
                  ),
              );
              const checkedRanges = pluginState.checkedRanges.flatMap((range) => {
                let remaining = [range];

                for (const invalid of invalidRanges) {
                  remaining = remaining.flatMap((part) => {
                    if (
                      !overlaps(part.from, part.to, invalid.from, invalid.to)
                    ) {
                      return [part];
                    }

                    if (invalid.from === invalid.to) {
                      return [
                        ...(invalid.from > part.from
                          ? [{ from: part.from, to: invalid.from }]
                          : []),
                        ...(invalid.from < part.to
                          ? [{ from: invalid.from, to: part.to }]
                          : []),
                      ];
                    }

                    return [
                      ...(invalid.from > part.from
                        ? [{ from: part.from, to: invalid.from }]
                        : []),
                      ...(invalid.to < part.to
                        ? [{ from: invalid.to, to: part.to }]
                        : []),
                    ];
                  });
                }

                return remaining.filter((part) => part.to > part.from);
              });

              return {
                matches,
                checkedRanges,
                decorations: createDecorations(tr.doc, matches),
              };
            }

            if (!tr.docChanged) return pluginState;

            const matches = mapRanges(pluginState.matches, tr.mapping);
            const checkedRanges = mapRanges(pluginState.checkedRanges, tr.mapping);

            return {
              matches,
              checkedRanges,
              decorations: createDecorations(tr.doc, matches),
            };
          },
        },
        props: {
          decorations(state) {
            return grammarHighlightKey.getState(state)?.decorations;
          },
        },
      }),
    ];
  },
});

export default GrammarHighlight;
