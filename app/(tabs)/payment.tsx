import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function PaymentScreen() {
  const [selectedType, setSelectedType] = useState<"income" | "expense">("income");

  return (
    <Container>
      <View style={styles.typeTabs}>
        <Pressable
          onPress={() => setSelectedType("income")}
          style={[styles.typeTab, selectedType === "income" && styles.typeTabActive]}
        >
          <Text style={[styles.typeTabText, selectedType === "income" && styles.typeTabTextActive]}>Pemasukan</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedType("expense")}
          style={[styles.typeTab, selectedType === "expense" && styles.typeTabActive]}
        >
          <Text style={[styles.typeTabText, selectedType === "expense" && styles.typeTabTextActive]}>Pengeluaran</Text>
        </Pressable>
      </View>

      <Pressable style={styles.fab} onPress={() => router.push("/payment/add")}>
        <MaterialCommunityIcons name="plus" size={30} color="white" />
      </Pressable>
    </Container>
  );
}

const styles = StyleSheet.create({
  typeTabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: "center",
  },
  typeTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  typeTabTextActive: {
    color: "white",
  },
  fab: {
    position: "absolute",
    right: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: Colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
