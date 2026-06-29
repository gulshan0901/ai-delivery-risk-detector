export function parseSseMessages(buffer) {
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() || "";
  const messages = blocks
    .map(block =>
      block
        .split("\n")
        .filter(line => line.startsWith("data:"))
        .map(line => line.replace(/^data:\s?/, ""))
        .join("\n")
    )
    .filter(Boolean)
    .map(message => JSON.parse(message));

  return { messages, remainder };
}
