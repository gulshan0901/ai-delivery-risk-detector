import { MAX_UPLOAD_CHARS } from "../constants/config";

export function prepareArtifactContent(content) {
  if (content.length <= MAX_UPLOAD_CHARS) {
    return { content, truncated: false, originalLength: content.length };
  }

  const headLength = Math.floor(MAX_UPLOAD_CHARS * 0.78);
  const tailLength = Math.floor(MAX_UPLOAD_CHARS * 0.12);
  const head = content.slice(0, headLength);
  const tail = content.slice(-tailLength);
  const omitted = content.length - head.length - tail.length;
  return {
    content: `${head}\n\n[... ${omitted} characters omitted from large upload preview ...]\n\n${tail}`,
    truncated: true,
    originalLength: content.length
  };
}

export function withSourceBadge(artifacts, source) {
  const badge = source === "sample" ? "Sample" : source === "live" ? "Live" : "Uploaded";
  return artifacts.map(artifact => ({ ...artifact, source, badge: artifact.badge || badge }));
}

export async function readBrowserFiles(fileList) {
  const selectedFiles = Array.from(fileList || []);
  return Promise.all(
    selectedFiles.map(async file => {
      const prepared = prepareArtifactContent(await file.text());
      return {
        name: file.name,
        type: file.type || "Uploaded artifact",
        content: prepared.content,
        truncated: prepared.truncated,
        originalLength: prepared.originalLength
      };
    })
  );
}
