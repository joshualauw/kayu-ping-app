import { Colors } from "@/constants/theme";
import { db } from "@/db/client";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { Suspense } from "react";
import { ActivityIndicator } from "react-native";
import Toast from "react-native-toast-message";
import migrations from "../drizzle/migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

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
      />
      <Toast />
    </Suspense>
  );
}
