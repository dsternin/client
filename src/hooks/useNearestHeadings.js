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
  pageContext,
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
      // Do not clear section/point from URL during a book transition —
      // the params are still needed by the navigation effect to scroll to the target.
      return;
    }

    const { heads1, heads2 } = getHeadingsFromJsonWithIndex(fullDoc);
    const idxMap1 = Object.fromEntries(heads1.map((h) => [h.id, h.blockIndex]));
    const idxMap2 = Object.fromEntries(heads2.map((h) => [h.id, h.blockIndex]));

    const fallbackSection = pageContext?.section || "";
    const fallbackPoint = pageContext?.point || "";

    const getOwnerH1 = (blockIndex) => {
      let owner = null;
      for (let i = 0; i < heads1.length; i++) {
        if (heads1[i].blockIndex <= blockIndex) owner = heads1[i];
        else break;
      }
      return owner;
    };

    const getNextH1After = (h1) => {
      if (!h1) return null;
      for (let i = 0; i < heads1.length; i++) {
        if (heads1[i].blockIndex > h1.blockIndex) return heads1[i];
      }
      return null;
    };

    function updateOnScroll() {
      const centerY = window.innerHeight / 2;
      const domH1 = Array.from(document.querySelectorAll("h1[id]"));
      const domH2 = Array.from(document.querySelectorAll("h2[id]"));

      const visibleH1 = domH1
        .map((el) => ({ el, top: el.getBoundingClientRect().top }))
        .filter((item) => item.top < centerY)
        .sort((a, b) => b.top - a.top);

      let nextSection = "";
      let nextPoint = "";

      if (visibleH1.length) {
        const nearestH1El = visibleH1[0].el;
        const nearestH1Idx = idxMap1[nearestH1El.id];
        nextSection = nearestH1El.id;

        const nextH1El = domH1
          .find((el) => idxMap1[el.id] > nearestH1Idx);

        const visibleH2 = domH2
          .filter((el) => {
            const idx = idxMap2[el.id];
            if (typeof idx !== "number") return false;
            const rect = el.getBoundingClientRect();
            if (rect.top >= centerY) return false;
            if (
              !(
                nearestH1El.compareDocumentPosition(el) &
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

        if (visibleH2.length) {
          nextPoint = visibleH2[0].id || "";
        } else {
          nextPoint = fallbackSection === nextSection ? fallbackPoint : "";
        }
      } else {
        const visibleH2Only = domH2
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.top < centerY;
          })
          .sort(
            (a, b) =>
              b.getBoundingClientRect().top - a.getBoundingClientRect().top
          );

        if (visibleH2Only.length) {
          const h2El = visibleH2Only[0];
          const h2Idx = idxMap2[h2El.id];
          const ownerH1 = getOwnerH1(h2Idx);
          nextSection = ownerH1?.id || fallbackSection;
          nextPoint = h2El.id;
        } else {
          nextSection = fallbackSection;
          nextPoint = fallbackPoint;
        }
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
  }, [setSection, setPoint, fullDoc, pageContext, syncUrl]);
}
