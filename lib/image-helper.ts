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

export const replaceFileOnDisk = (oldUri: string | null, newTempUri: string): string => {
  try {
    if (oldUri) {
      const oldFile = new File(oldUri);
      if (oldFile.exists) {
        oldFile.delete();
      }
    }

    return saveFileToDisk(newTempUri);
  } catch (error) {
    console.error("Failed to replace file:", error);
    throw error;
  }
};

export const deleteFileFromDisk = (uri: string): void => {
  try {
    const file = new File(uri);
    file.delete();
  } catch (error) {
    console.error("Failed to delete file:", error);
  }
};
