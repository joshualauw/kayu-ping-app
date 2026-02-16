import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { DATABASE_NAME, expoDb } from "@/db/client";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import * as Updates from "expo-updates";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { unzip, zip } from "react-native-zip-archive";

const MEDIA_FOLDER_NAME = "media";

export default function SettingsScreen() {
  async function handleExport() {
    try {
      await expoDb.execAsync("PRAGMA wal_checkpoint(FULL);");

      const dbPath = Paths.join(Paths.document, "SQLite", DATABASE_NAME);
      const mediaPath = Paths.join(Paths.document, MEDIA_FOLDER_NAME);
      const zipPath = Paths.join(Paths.cache, "backup.zip");

      const dbFileInfo = await FileSystem.getInfoAsync(dbPath);
      if (!dbFileInfo.exists) {
        console.error("Database does not exist at path:", dbPath);
        return;
      }

      const exportFolder = Paths.join(Paths.cache, "export_temp");
      await FileSystem.makeDirectoryAsync(exportFolder, { intermediates: true });

      await FileSystem.copyAsync({
        from: dbPath,
        to: Paths.join(exportFolder, DATABASE_NAME),
      });

      const mediaFiles = await FileSystem.readDirectoryAsync(mediaPath);
      const tempMediaFolder = Paths.join(exportFolder, MEDIA_FOLDER_NAME);
      await FileSystem.makeDirectoryAsync(tempMediaFolder, { intermediates: true });

      for (const fileName of mediaFiles) {
        await FileSystem.copyAsync({
          from: Paths.join(mediaPath, fileName),
          to: Paths.join(tempMediaFolder, fileName),
        });
      }

      const zippedPath = await zip(exportFolder, zipPath);
      const fileUri = zippedPath.startsWith("file://") ? zippedPath : `file://${zippedPath}`;
      console.log("ZIP created at:", fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }

      await FileSystem.deleteAsync(exportFolder, { idempotent: true });
    } catch (error) {
      alert("Gagal mengekspor data");
      console.error("Gagal mengekspor data:", error);
    }
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/zip",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const selectedFileUri = result.assets[0].uri;
      const tempImportFolder = Paths.join(Paths.cache, "import_temp");

      await FileSystem.deleteAsync(tempImportFolder, { idempotent: true });
      await FileSystem.makeDirectoryAsync(tempImportFolder, { intermediates: true });

      await unzip(selectedFileUri, tempImportFolder);

      await expoDb.closeAsync();

      const importedDbPath = Paths.join(tempImportFolder, DATABASE_NAME);
      const targetDbPath = Paths.join(Paths.document, "SQLite", DATABASE_NAME);

      if ((await FileSystem.getInfoAsync(importedDbPath)).exists) {
        await FileSystem.copyAsync({
          from: importedDbPath,
          to: targetDbPath,
        });
      }

      const importedMediaPath = Paths.join(tempImportFolder, MEDIA_FOLDER_NAME);
      const targetMediaPath = Paths.join(Paths.document, MEDIA_FOLDER_NAME);

      const importedMediaExists = await FileSystem.getInfoAsync(importedMediaPath);
      if (importedMediaExists.exists) {
        await FileSystem.deleteAsync(targetMediaPath, { idempotent: true });
        await FileSystem.makeDirectoryAsync(targetMediaPath, { intermediates: true });

        const mediaFiles = await FileSystem.readDirectoryAsync(importedMediaPath);
        for (const fileName of mediaFiles) {
          await FileSystem.copyAsync({
            from: Paths.join(importedMediaPath, fileName),
            to: Paths.join(targetMediaPath, fileName),
          });
        }
      }

      await FileSystem.deleteAsync(tempImportFolder, { idempotent: true });
      alert("Data berhasil diimpor. Aplikasi akan dimulai ulang untuk menerapkan perubahan.");
      await Updates.reloadAsync();
    } catch (error) {
      alert("Gagal mengimpor data");
      console.error("Gagal mengimpor data:", error);
    }
  }

  return (
    <Container>
      <Stack.Screen options={{ title: "Pengaturan" }} />

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Manajemen Data</Text>

        <TouchableOpacity style={styles.settingsItem} onPress={handleImport}>
          <MaterialIcons name="file-download" size={24} color={Colors.primary} style={styles.icon} />
          <Text style={styles.settingsText}>Impor Data</Text>
          <MaterialIcons name="chevron-right" size={24} color={Colors.border} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem} onPress={handleExport}>
          <MaterialIcons name="file-upload" size={24} color={Colors.primary} style={styles.icon} />
          <Text style={styles.settingsText}>Ekspor Data</Text>
          <MaterialIcons name="chevron-right" size={24} color={Colors.border} />
        </TouchableOpacity>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.md,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    letterSpacing: 0.5,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  icon: {
    marginRight: Spacing.md,
  },
  settingsText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
});
