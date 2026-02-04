import { File, Paths } from "expo-file-system";

export const saveFileToDisk = (tempUri: string): string => {
  const source = new File(tempUri);
  const fileName = source.name || `media_${Date.now()}.jpg`;
  const destination = new File(Paths.document, fileName);

  try {
    source.copy(destination);

    return destination.uri;
  } catch (error) {
    console.error("Failed to persist file:", error);
    throw error;
  }
};
