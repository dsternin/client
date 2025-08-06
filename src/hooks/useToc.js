import { useEffect, useState } from "react";

export default function useToc() {
  const [toc, setToc] = useState([]);
  const [trigger, setTrigger] = useState(false);
  useEffect(() => {
    fetch("/api/content/toc")
      .then((res) => res.json())
      .then((data) => {
        setToc(data);
      });
  }, [trigger]);
  return { toc, trigger: () => setTrigger((prev) => !prev) };
}
