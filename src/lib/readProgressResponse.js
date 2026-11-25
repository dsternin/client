export async function readProgressResponse(response, onProgress, fallbackMessage, interruptedMessage) {
  if (!response.ok) {
    let message = fallbackMessage;
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch (error) {
      console.error("Не удалось прочитать сообщение об ошибке:", error);
    }
    throw new Error(message);
  }
  if (!response.body) throw new Error("Сервер не передал данные о выполнении операции");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  let result;
  try {
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (error) {
        console.error("Соединение для передачи прогресса прервано:", error);
        throw new Error(interruptedMessage);
      }
      const { done, value } = chunk;
      buffer += decoder.decode(value, { stream: !done });
      let end = buffer.indexOf("\n");
      while (end !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (line) {
          const event = JSON.parse(line);
          if (event.type === "progress") onProgress(event);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "complete") {
            completed = true;
            result = event.result;
          }
        }
        end = buffer.indexOf("\n");
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!completed || buffer.trim()) throw new Error(interruptedMessage);
  return result;
}
