import { useEffect, useState } from "react";

export default function useToc() {
  const [toc, setToc] = useState([]);
  useEffect(() => {
    fetch("/api/content/toc")
      .then((res) => res.json())
      .then((data) => {
        setToc(data);
      });
  }, []);
  return toc;
}
