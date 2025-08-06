// hooks/useNearestHeadings.js
"use client";
import { useEffect } from "react";

function getHeadingsFromJsonWithIndex(doc) {
  const heads1 = [];
  const heads2 = [];
  doc.content.forEach((node, idx) => {
    if (node.type === "heading" && node.attrs?.id) {
      if (node.attrs.level === 1) heads1.push({ id: node.attrs.id, blockIndex: idx });
      else if (node.attrs.level === 2) heads2.push({ id: node.attrs.id, blockIndex: idx });
    }
  });
  return { heads1, heads2 };
}

export default function useNearestHeadings(
  setSection,
  setPoint,
  fullDoc,
  currentPage,
  pageBlockSize
) {
  useEffect(() => {
    if (!fullDoc) {
      setSection("");
      setPoint("");
      return;
    }

    const { heads1, heads2 } = getHeadingsFromJsonWithIndex(fullDoc);

    // Быстрый lookup id -> blockIndex
    const idxMap1 = Object.fromEntries(heads1.map(h => [h.id, h.blockIndex]));
    const idxMap2 = Object.fromEntries(heads2.map(h => [h.id, h.blockIndex]));

    const pageStart = currentPage * pageBlockSize;
    const pageEnd = pageStart + pageBlockSize;

    // Фолбек: последний H1 из всех предыдущих блоков
    function fallbackH1() {
      const prev = heads1.filter(h => h.blockIndex < pageStart);
      if (!prev.length) return undefined;
      return prev.reduce((a, b) => (a.blockIndex > b.blockIndex ? a : b));
    }
    // Фолбек: последний H2 внутри данной H1
    function fallbackH2(withinH1) {
      if (!withinH1) return undefined;
      const nextH1 = heads1.find(h => h.blockIndex > withinH1.blockIndex);
      const candidates = heads2.filter(h =>
        h.blockIndex > withinH1.blockIndex &&
        (!nextH1 || h.blockIndex < nextH1.blockIndex)
      );
      if (!candidates.length) return undefined;
      return candidates.reduce((a, b) => (a.blockIndex > b.blockIndex ? a : b));
    }

    function updateOnScroll() {
      const centerY = window.innerHeight / 2;
      const domH1 = Array.from(document.querySelectorAll("h1[id]"));
      const domH2 = Array.from(document.querySelectorAll("h2[id]"));

      // 1) Основной поиск H1 на текущей странице
      const visibleH1 = domH1
        .filter(el => {
          const idx = idxMap1[el.id];
          return idx >= pageStart && idx < pageEnd;
        })
        .map(el => ({ el, top: el.getBoundingClientRect().top }))
        .filter(item => item.top < centerY)
        .sort((a, b) => b.top - a.top);

      if (visibleH1.length) {
        const nearestH1 = visibleH1[0].el;
        setSection(nearestH1.id);

        // Поинты: H2 на текущей странице внутри этой секции
        const nextH1El = domH1
          .filter(el => {
            const idx = idxMap1[el.id];
            return idx >= pageStart && idx < pageEnd;
          })
          .find(el => idxMap1[el.id] > idxMap1[nearestH1.id]);

        const visibleH2 = domH2
          .filter(el => {
            const idx = idxMap2[el.id];
            if (idx < pageStart || idx >= pageEnd) return false;
            const rect = el.getBoundingClientRect();
            if (rect.top >= centerY) return false;
            // el после nearestH1 в документе
            if (!(nearestH1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
            // el до nextH1El
            if (nextH1El && !(nextH1El.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) return false;
            return true;
          })
          .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);

        setPoint(visibleH2[0]?.id || "");
        return;
      }

      // 2) Фолбек: предыдущие страницы
      const fbH1 = fallbackH1();
      setSection(fbH1?.id || "");
      const fbH2 = fallbackH2(fbH1);
      setPoint(fbH2?.id || "");
    }

    window.addEventListener("scroll", updateOnScroll, { passive: true });
    updateOnScroll();
    return () => window.removeEventListener("scroll", updateOnScroll);
  }, [setSection, setPoint, fullDoc, currentPage, pageBlockSize]);
}
