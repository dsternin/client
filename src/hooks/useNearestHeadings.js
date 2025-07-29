import { useEffect } from "react";

export default function useNearestHeadings(setSection, setPoint) {
  useEffect(() => {
    function updateNearestHeadings() {
      const centerY = window.innerHeight / 2;

      const allH1 = Array.from(document.querySelectorAll("h1[id]"));
      const allH2 = Array.from(document.querySelectorAll("h2[id]"));

      const nearestH1 = allH1
        .filter((el) => el.getBoundingClientRect().top < centerY)
        .sort(
          (a, b) =>
            b.getBoundingClientRect().top - a.getBoundingClientRect().top
        )[0];

      const nearestH2 = allH2
        .filter((el) => el.getBoundingClientRect().top < centerY)
        .sort(
          (a, b) =>
            b.getBoundingClientRect().top - a.getBoundingClientRect().top
        )[0];

      if (nearestH1) {
        setSection(nearestH1.id);

        if (nearestH2) {
          const h1BeforeH2 =
            nearestH1.compareDocumentPosition(nearestH2) &
            Node.DOCUMENT_POSITION_FOLLOWING;
          if (h1BeforeH2) {
            setPoint(nearestH2.id);
          } else {
            setPoint("");
          }
        } else {
          setPoint("");
        }
      }
    }

    window.addEventListener("scroll", updateNearestHeadings, { passive: true });
    updateNearestHeadings();

    return () => {
      window.removeEventListener("scroll", updateNearestHeadings);
    };
  }, [setSection, setPoint]);
}
