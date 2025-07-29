# client
  const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log("Видимий заголовок:", entry.target.textContent);
            // онови стан активного заголовка
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: "0px",
        threshold: 0.1, // 10% в полі зору
      }
    )