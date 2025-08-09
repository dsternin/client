"use client";
import { useEffect, useRef } from "react";

function getHeadingsFromJsonWithIndex(doc) {
  const heads1 = [];
  const heads2 = [];
  doc.content.forEach((node, idx) => {
    if (node.type === "heading" && node.attrs?.id) {
      if (node.attrs.level === 1)
        heads1.push({ id: node.attrs.id, blockIndex: idx });
      else if (node.attrs.level === 2)
        heads2.push({ id: node.attrs.id, blockIndex: idx });
    }
  });
  return { heads1, heads2 };
}

export default function useNearestHeadings(
  setSection,
  setPoint,
  fullDoc,
  currentPage,
  pageBlockSize,
  { syncUrl = true } = {}
) {
  const rafRef = useRef(null);
  const lastSyncedRef = useRef(null);
  const mountedRef = useRef(false);

  const scheduleUrlSync = (section, point) => {
    if (!syncUrl) return;
    const prev = lastSyncedRef.current;
    if (prev && prev.section === section && prev.point === point) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTimeout(() => {
        const prev2 = lastSyncedRef.current;
        if (prev2 && prev2.section === section && prev2.point === point) return;
        const url = new URL(window.location.href);
        if (section) url.searchParams.set("section", section);
        else url.searchParams.delete("section");
        if (point) url.searchParams.set("point", point);
        else url.searchParams.delete("point");
        window.history.replaceState(window.history.state, "", url.toString());
        lastSyncedRef.current = { section, point };
      }, 120);
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!fullDoc) {
      setSection("");
      setPoint("");
      if (syncUrl) scheduleUrlSync("", "");
      return;
    }

    const { heads1, heads2 } = getHeadingsFromJsonWithIndex(fullDoc);
    const idxMap1 = Object.fromEntries(heads1.map((h) => [h.id, h.blockIndex]));
    const idxMap2 = Object.fromEntries(heads2.map((h) => [h.id, h.blockIndex]));
    const pageStart = currentPage * pageBlockSize;
    const pageEnd = pageStart + pageBlockSize;

    function fallbackH1() {
      const prev = heads1.filter((h) => h.blockIndex < pageStart);
      if (!prev.length) return undefined;
      return prev.reduce((a, b) => (a.blockIndex > b.blockIndex ? a : b));
    }
    function fallbackH2(withinH1) {
      if (!withinH1) return;
      const nextH1 = heads1.find((h) => h.blockIndex > withinH1.blockIndex);
      const candidates = heads2.filter(
        (h) =>
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

      const visibleH1 = domH1
        .filter((el) => {
          const idx = idxMap1[el.id];
          return idx >= pageStart && idx < pageEnd;
        })
        .map((el) => ({ el, top: el.getBoundingClientRect().top }))
        .filter((item) => item.top < centerY)
        .sort((a, b) => b.top - a.top);

      let nextSection = "";
      let nextPoint = "";

      if (visibleH1.length) {
        const nearestH1 = visibleH1[0].el;
        nextSection = nearestH1.id;

        const nextH1El = domH1
          .filter((el) => {
            const idx = idxMap1[el.id];
            return idx >= pageStart && idx < pageEnd;
          })
          .find((el) => idxMap1[el.id] > idxMap1[nearestH1.id]);

        const visibleH2 = domH2
          .filter((el) => {
            const idx = idxMap2[el.id];
            if (idx < pageStart || idx >= pageEnd) return false;
            const rect = el.getBoundingClientRect();
            if (rect.top >= centerY) return false;
            if (
              !(
                nearestH1.compareDocumentPosition(el) &
                Node.DOCUMENT_POSITION_FOLLOWING
              )
            )
              return false;
            if (
              nextH1El &&
              !(
                nextH1El.compareDocumentPosition(el) &
                Node.DOCUMENT_POSITION_PRECEDING
              )
            )
              return false;
            return true;
          })
          .sort(
            (a, b) =>
              b.getBoundingClientRect().top - a.getBoundingClientRect().top
          );

        nextPoint = visibleH2[0]?.id || "";
      } else {
        const fbH1 = fallbackH1();
        nextSection = fbH1?.id || "";
        const fbH2 = fallbackH2(fbH1);
        nextPoint = fbH2?.id || "";
      }

      setSection(nextSection);
      setPoint(nextPoint);
      if (!mountedRef.current) return;
      scheduleUrlSync(nextSection, nextPoint);
    }

    const onScroll = () => updateOnScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    updateOnScroll();
    mountedRef.current = true;

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [setSection, setPoint, fullDoc, currentPage, pageBlockSize, syncUrl]);
}
