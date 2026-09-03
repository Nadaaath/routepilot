export async function resolveMapUrl(
  mapUrl: string
): Promise<string | null> {
  // First make sure this is actually a URL
  let url: URL;

  try {
    url = new URL(mapUrl);
  } catch {
    return null;
  }

  // Only accept HTTP/HTTPS URLs
  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return null;
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
    });

    return response.url;
  } catch (error) {
    console.error("Failed to resolve map URL:", error);
    return null;
  }
}