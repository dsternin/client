export function progressResponse(operation, errorMessage) {
  const encoder = new TextEncoder();
  let active = true;
  let lastStage = "";
  let lastSent = 0;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch (error) {
          active = false;
          console.warn("Соединение для передачи прогресса закрыто:", error);
        }
      };
      const progress = (stage, fraction) => {
        const now = Date.now();
        if (stage === lastStage && now - lastSent < 250) return;
        lastStage = stage;
        lastSent = now;
        send({
          type: "progress",
          stage,
          percent: fraction === null ? null : Math.min(99, Math.max(0, Math.floor(fraction * 100))),
        });
      };
      send({ type: "progress", stage: "Подготовка", percent: null });
      Promise.resolve()
        .then(() => operation(progress))
        .then((result) => send({ type: "complete", percent: 100, result }))
        .catch((error) => {
          console.error(errorMessage, error);
          send({ type: "error", error: errorMessage });
        })
        .finally(() => {
          if (active) {
            try {
              controller.close();
            } catch (error) {
              console.warn("Не удалось закрыть поток прогресса:", error);
            }
          }
        });
    },
    cancel() {
      active = false;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
