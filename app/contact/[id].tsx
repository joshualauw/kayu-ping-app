import { router, Stack, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts } from "@/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";

interface ContactDetail {
  id: number;
  name: string;
  phoneNumber: string;
  category: string;
  notes: string | null;
  createdAt: string | null;
}

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams();
  const [contact, setContact] = useState<ContactDetail | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      const result = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, Number(id)))
        .limit(1);

      if (result.length > 0) setContact(result[0]);
    };
    fetchDetail();
  }, [id]);

  if (!contact) return <Text>Loading...</Text>;

  const makeCall = () => Linking.openURL(`tel:${contact.phoneNumber}`);
  const sendWhatsapp = () => Linking.openURL(`whatsapp://send?phone=${contact.phoneNumber}`);

  return (
    <Container>
      <ScrollView>
        <Stack.Screen
          options={{
            title: "Detail Kontak",
            headerShadowVisible: false,
            headerRight: () => (
              <Pressable onPress={() => router.push(`/edit/${contact.id}`)}>
                <Text style={{ color: Colors.primary, fontWeight: "600" }}>Edit</Text>
              </Pressable>
            ),
          }}
        />

        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{contact.name}</Text>
          <Text style={styles.categoryTag}>{contact.category.toUpperCase()}</Text>
        </View>

        <View style={styles.actionRow}>
          <ActionBtn icon="call" label="Call" onPress={makeCall} color={Colors.accent} />
          <ActionBtn icon="logo-whatsapp" label="WhatsApp" onPress={sendWhatsapp} color={Colors.accent} />
          <ActionBtn
            icon="chatbubble-outline"
            label="SMS"
            onPress={() => Linking.openURL(`sms:${contact.phoneNumber}`)}
            color={Colors.accent}
          />
        </View>

        <View style={styles.infoBox}>
          <InfoItem label="Nomor Telepon" value={contact.phoneNumber} icon="call-outline" />
          <InfoItem label="Kategori" value={contact.category} icon="pricetag-outline" />
          {contact.notes && <InfoItem label="Notes" value={contact.notes} icon="document-text-outline" />}
          <InfoItem
            label="Ditambahkan Pada"
            value={contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : "-"}
            icon="calendar-outline"
          />
        </View>
      </ScrollView>
    </Container>
  );
}

const ActionBtn = ({ icon, label, onPress, color }: any) => (
  <Pressable style={styles.actionBtn} onPress={onPress}>
    <View style={[styles.iconCircle, { backgroundColor: color }]}>
      <Ionicons name={icon} size={24} color="white" />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </Pressable>
);

const InfoItem = ({ label, value, icon }: any) => (
  <View style={styles.infoItem}>
    <Ionicons name={icon} size={20} color="#666" style={{ marginRight: 12 }} />
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.lg, backgroundColor: Colors.background },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatarText: { color: "white", fontSize: 32, fontWeight: "bold" },
  name: { fontSize: 24, fontWeight: "bold", color: Colors.text, textAlign: "center" },
  categoryTag: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  actionBtn: { alignItems: "center" },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  actionLabel: { fontSize: 12, color: Colors.text },
  infoBox: { marginTop: Spacing.md, backgroundColor: Colors.background, paddingHorizontal: Spacing.md },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  infoLabel: { fontSize: 12, color: "#666", marginBottom: Spacing.xs },
  infoValue: { fontSize: 16, color: Colors.text },
});
