export function getPrimarySource(item) {
  return item.sources?.[0]?.kind ?? "unknown";
}

export function sourceText(item) {
  const source = item.sources?.[0];
  if (!source) {
    return "Source not mapped yet.";
  }

  if (item.sources.length === 1) {
    return source.text === "Fonte ainda nao mapeada." ? "Source not mapped yet." : source.text;
  }

  const text = source.text === "Fonte ainda nao mapeada." ? "Source not mapped yet." : source.text;
  return `${text} +${item.sources.length - 1}`;
}
