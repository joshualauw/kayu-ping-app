import { Colors } from "@/constants/theme";
import { db, expoDb } from "@/db/client";
import "@/lib/dayjs-config";
import { scheduleDailyReminder } from "@/lib/push-notification";
import { MaterialIcons } from "@expo/vector-icons";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { Suspense, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import migrations from "../drizzle/migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  useDrizzleStudio(expoDb);

  useEffect(() => {
    if (success) {
      scheduleDailyReminder();
    }
  }, [success]);

  useEffect(() => {
    async function seeding() {
      if (__DEV__) {
        const { runSeed } = await import("@/db/seed");
        await runSeed(db);
      }
    }
    seeding();
  }, []);

  if (!success && !error) return <LoadingScreen />;
  if (error) return <ErrorScreen onRetry={() => Updates.reloadAsync()} />;

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.secondary,
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="reports" options={{ title: "Laporan" }} />
        <Stack.Screen name="(tabs)" options={{ title: "Transaksi" }} />
      </Stack>
      <Toast />
    </Suspense>
  );
}

export const LoadingScreen = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color="#6200ee" />
  </View>
);

export const ErrorScreen = ({ onRetry }: { onRetry: () => void }) => (
  <View style={styles.container}>
    <View style={styles.iconContainer}>
      <MaterialIcons name="storage" size={64} color="#ffdde1" />
      <MaterialIcons name="error" size={24} color="#ff4d4d" style={styles.errorBadge} />
    </View>

    <Text style={styles.title}>Koneksi Database Gagal</Text>
    <Text style={styles.message}>Kami mengalami kendala saat memuat data lokal Anda.</Text>

    <TouchableOpacity style={styles.button} onPress={onRetry}>
      <Text style={styles.buttonText}>Coba Lagi</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#fff",
  },
  iconContainer: {
    marginBottom: 20,
    position: "relative",
  },
  errorBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 30,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
