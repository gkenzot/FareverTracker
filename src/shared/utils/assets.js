export function assetPath(path) {
  if (!path) {
    return "";
  }

  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
