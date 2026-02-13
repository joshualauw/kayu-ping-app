import { Container } from "@/components/Container";
import DeleteModal from "@/components/DeleteModal";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices, paymentAllocations, payments } from "@/db/schema";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { deleteFileFromDisk } from "@/lib/image-helper";
import { getPaymentMethodLabel } from "@/lib/label-helper";
import { formatCurrency } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";

interface PaymentDetail {
  id: number;
  clientName: string;
  amount: number;
  paymentDate: string;
  notes: string | null;
  method: "cash" | "bank_transfer" | "others";
  type: "income" | "expense";
  mediaUrl: string | null;
  allocations: {
    id: number;
    entryDate: string;
    amount: number;
  }[];
}

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams();
  const { isVisible, show, hide, item } = useDeleteConfirm();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);

  const handleDelete = async (paymentId: number) => {
    try {
      if (payment?.mediaUrl) {
        await deleteFileFromDisk(payment.mediaUrl);
      }

      await db.delete(payments).where(eq(payments.id, paymentId));

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: "Pembayaran dihapus",
      });
      router.replace("/payment");
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Gagal!",
        text2: "Gagal menghapus pembayaran",
      });
    }
  };

  const confirmDelete = () => {
    if (item) {
      handleDelete(item.id);
    }
    hide();
  };

  useFocusEffect(
    useCallback(() => {
      const fetchDetail = async () => {
        if (!id || loading) return;

        try {
          setLoading(true);

          const res = await db
            .select({
              id: payments.id,
              clientName: contacts.name,
              amount: payments.amount,
              paymentDate: payments.paymentDate,
              notes: payments.notes,
              type: payments.type,
              method: payments.method,
              mediaUrl: payments.mediaUri,
            })
            .from(payments)
            .leftJoin(contacts, eq(payments.contactId, contacts.id))
            .where(eq(payments.id, Number(id)))
            .get();

          if (!res) {
            setPayment(null);
            return;
          }

          const allocationRows = await db
            .select({
              id: invoices.id,
              entryDate: invoices.entryDate,
              amount: paymentAllocations.amount,
              originalAmount: invoices.amount,
            })
            .from(paymentAllocations)
            .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
            .where(eq(paymentAllocations.paymentId, Number(id)));

          const allocations = allocationRows
            .filter((row) => row.id !== null)
            .map((row) => ({
              id: row.id!,
              entryDate: row.entryDate || "",
              amount: row.amount,
            }));

          setPayment({
            ...res,
            allocations,
          } as PaymentDetail);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      };

      fetchDetail();
    }, [id]),
  );

  if (!payment) return <Text>Loading...</Text>;

  return (
    <Container>
      <ScrollView>
        <Stack.Screen options={{ title: "Detail Pembayaran" }} />

        <View style={styles.header}>
          <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
          <Text style={styles.name}>{payment.clientName}</Text>
          <Text style={styles.typeTag}>{(payment.type === "income" ? "pemasukan" : "pengeluaran").toUpperCase()}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.actionButton, styles.editButton]}
              onPress={() => router.push(`/payment/${payment.id}/edit`)}
            >
              <Text style={styles.editButtonText}>Ubah</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => show(payment)}>
              <Text style={styles.deleteButtonText}>Hapus</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoBox}>
          <InfoItem
            label="Tanggal Pembayaran"
            value={payment.paymentDate ? dayjs(payment.paymentDate).format("DD MMM YYYY") : "-"}
            icon="calendar-outline"
          />
          <InfoItem label="Metode Pembayaran" value={getPaymentMethodLabel(payment.method)} icon="card-outline" />
          {payment.notes && <InfoItem label="Catatan" value={payment.notes} icon="document-text-outline" />}
          {payment.mediaUrl && (
            <Pressable style={styles.photoItem} onPress={() => setPhotoVisible(true)}>
              <View style={styles.photoItemLeft}>
                <Ionicons name="image-outline" size={20} color={Colors.text} style={{ marginRight: 12 }} />
                <Text style={styles.photoItemText}>Lihat Foto</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.text} />
            </Pressable>
          )}
        </View>

        {payment.allocations.length > 0 && (
          <View style={styles.allocationBox}>
            <Text style={styles.sectionTitle}>Nota Terkait</Text>
            <View style={styles.allocationsSection}>
              {payment.allocations.map((allocation, index) => (
                <Pressable
                  key={`${allocation.id}-${index}`}
                  style={({ pressed }) => [
                    styles.allocationItem,
                    { backgroundColor: pressed ? Colors.secondary : "transparent" },
                  ]}
                  onPress={() => router.push(`/invoice/${allocation.id}`)}
                >
                  <View style={styles.allocationLeft}>
                    <Text style={styles.allocationDate}>{dayjs(allocation.entryDate).format("DD MMM YYYY")}</Text>
                  </View>
                  <View style={styles.allocationRight}>
                    <Text style={styles.allocationAmount}>{formatCurrency(allocation.amount)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <DeleteModal
        visible={isVisible}
        title="Hapus Pembayaran?"
        message="Pembayaran akan dihapus permanen dan tidak bisa dikembalikan."
        onConfirm={confirmDelete}
        onCancel={hide}
      />

      <Modal visible={photoVisible} transparent animationType="fade">
        <Pressable style={styles.photoOverlay} onPress={() => setPhotoVisible(false)}>
          <Pressable style={styles.photoContainer} onPress={() => null}>
            {payment.mediaUrl && (
              <Image source={{ uri: payment.mediaUrl }} style={styles.photoImage} resizeMode="contain" />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

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
  amount: { fontSize: 28, fontWeight: "700", color: Colors.text },
  name: { fontSize: 18, fontWeight: "600", color: Colors.text, marginTop: Spacing.sm },
  typeTag: {
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
  infoBox: { marginTop: Spacing.md, backgroundColor: Colors.background, paddingHorizontal: Spacing.md },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  photoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  photoItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  photoItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: "400",
  },
  infoLabel: { fontSize: 12, color: "#666", marginBottom: Spacing.xs },
  infoValue: { fontSize: 16, color: Colors.text },
  allocationBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: Spacing.sm },
  allocationsSection: {
    marginTop: Spacing.xs,
  },
  allocationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
  },
  allocationLeft: {
    flexDirection: "column",
    flex: 1,
  },
  allocationDate: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text,
  },
  allocationRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  allocationAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    width: "100%",
    paddingHorizontal: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    backgroundColor: Colors.secondary,
  },
  editButtonText: {
    color: Colors.text,
    fontWeight: "600",
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: Colors.danger,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  photoContainer: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
});
