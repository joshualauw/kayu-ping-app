import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { DATABASE_NAME, expoDb } from "@/db/client";
import { MaterialIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import * as Updates from "expo-updates";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { unzip, zip } from "react-native-zip-archive";

const MEDIA_FOLDER_NAME = "media";
const CURRENT_DB_VERSION = 8; // Lihat di drizzle folder migrations

export default function SettingsScreen() {
  async function handleExport() {
    try {
      await expoDb.execAsync("VACUUM;");
      await expoDb.execAsync("PRAGMA wal_checkpoint(FULL);");

      const baseDir = `${FileSystem.cacheDirectory}export_staging/`;
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

      const zipDest = `${FileSystem.cacheDirectory}backup.zip`;

      const manifest = {
        appVersion: Constants.expoConfig?.version || "N/A",
        dbVersion: CURRENT_DB_VERSION,
        exportDate: new Date().toISOString(),
        device: Constants.platform?.android ? "android" : Constants.platform?.ios ? "ios" : "unknown",
      };
      await FileSystem.writeAsStringAsync(`${baseDir}manifest.json`, JSON.stringify(manifest));

      const mediaSource = `${FileSystem.documentDirectory}${MEDIA_FOLDER_NAME}/`;
      await FileSystem.copyAsync({
        from: mediaSource,
        to: `${baseDir}${MEDIA_FOLDER_NAME}/`,
      });

      const dbSource = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
      await FileSystem.copyAsync({
        from: dbSource,
        to: `${baseDir}${DATABASE_NAME}`,
      });

      const zippedPath = await zip(baseDir, zipDest);

      const fileUri = zippedPath.startsWith("file://") ? zippedPath : `file://${zippedPath}`;
      console.log("ZIP created at:", fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }

      await FileSystem.deleteAsync(baseDir, { idempotent: true });
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

      const baseDir = `${FileSystem.cacheDirectory}import_staging/`;
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

      await unzip(selectedFileUri, baseDir);

      const stagingContent = await FileSystem.readDirectoryAsync(baseDir);
      if (!stagingContent.includes(MEDIA_FOLDER_NAME) || !stagingContent.includes(DATABASE_NAME)) {
        throw new Error("Invalid backup format");
      }

      await expoDb.closeAsync();

      const mediaSource = `${FileSystem.documentDirectory}${MEDIA_FOLDER_NAME}/`;
      await FileSystem.deleteAsync(mediaSource, { idempotent: true });
      await FileSystem.moveAsync({
        from: `${baseDir}${MEDIA_FOLDER_NAME}/`,
        to: mediaSource,
      });

      const dbSource = `${FileSystem.documentDirectory}SQLite/`;
      await FileSystem.moveAsync({
        from: `${baseDir}${DATABASE_NAME}`,
        to: `${dbSource}${DATABASE_NAME}`,
      });

      await FileSystem.deleteAsync(baseDir, { idempotent: true });

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
