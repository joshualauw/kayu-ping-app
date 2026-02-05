import { Colors } from "@/constants/theme";
import { db, expoDb } from "@/db/client";
import "@/lib/dayjs-config";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from "expo-router";
import { Suspense } from "react";
import { ActivityIndicator } from "react-native";
import Toast from "react-native-toast-message";
import migrations from "../drizzle/migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  useDrizzleStudio(expoDb);

  if (success) {
    console.log("Migrations applied successfully");
  }

  if (error) {
    console.error("Error applying migrations:", error);
  }

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
        <Stack.Screen name="(tabs)" options={{ title: "Transaksi" }} />
      </Stack>
      <Toast />
    </Suspense>
  );
}
