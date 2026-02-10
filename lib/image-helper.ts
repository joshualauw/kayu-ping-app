import * as FileSystem from "expo-file-system/legacy";

const MEDIA_FOLDER = `${FileSystem.documentDirectory}media/`;

export const saveFileToDisk = async (tempUri: string): Promise<string> => {
  const fileName = tempUri.split("/").pop() || `media_${Date.now()}.jpg`;

  await FileSystem.makeDirectoryAsync(MEDIA_FOLDER, { intermediates: true });

  const destination = `${MEDIA_FOLDER}${fileName}`;

  try {
    await FileSystem.copyAsync({
      from: tempUri,
      to: destination,
    });

    return destination;
  } catch (error) {
    console.error("Failed to persist file:", error);
    throw error;
  }
};

export const replaceFileOnDisk = async (oldUri: string | null, newTempUri: string): Promise<string> => {
  try {
    if (oldUri) {
      const info = await FileSystem.getInfoAsync(oldUri);
      if (info.exists) {
        await FileSystem.deleteAsync(oldUri);
      }
    }

    return saveFileToDisk(newTempUri);
  } catch (error) {
    console.error("Failed to replace file:", error);
    throw error;
  }
};

export const deleteFileFromDisk = async (uri: string): Promise<void> => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch (error) {
    console.error("Failed to delete file:", error);
  }
};
