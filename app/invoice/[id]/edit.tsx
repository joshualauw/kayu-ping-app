import { Container } from "@/components/Container";
import { image_compression_quality } from "@/constants/common";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices } from "@/db/schema";
import { replaceFileOnDisk } from "@/lib/image-helper";
import { formatDate, formatNumber } from "@/lib/utils";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as yup from "yup";

const schema = yup.object({
  code: yup.string().required("Kode wajib diisi"),
  entryDate: yup.date().required("Tanggal wajib diisi"),
  contactId: yup.number().required("Kontak wajib dipilih"),
  amount: yup.number().required("Jumlah wajib diisi").min(1, "Jumlah harus lebih dari 0"),
  type: yup.string().oneOf(["sales", "purchase"], "Tipe tidak valid").required("Tipe wajib dipilih"),
  notes: yup.string().optional(),
  mediaUri: yup.string().optional(),
});

type FormValues = yup.InferType<typeof schema>;

export default function InvoiceEditScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      code: "",
      entryDate: new Date(),
      contactId: 0,
      amount: 0,
      type: "sales",
    },
  });

  const [contactName, setContactName] = useState("");
  const [loading, setLoading] = useState(true);
  const [originalMediaUri, setOriginalMediaUri] = useState<string | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);

        const res = await db
          .select({
            id: invoices.id,
            code: invoices.code,
            entryDate: invoices.entryDate,
            contactId: invoices.contactId,
            contactName: contacts.name,
            amount: invoices.amount,
            type: invoices.type,
            notes: invoices.notes,
            mediaUri: invoices.mediaUri,
          })
          .from(invoices)
          .leftJoin(contacts, eq(invoices.contactId, contacts.id))
          .where(eq(invoices.id, Number(id)))
          .get();

        if (res) {
          reset({
            code: res.code,
            entryDate: new Date(res.entryDate),
            contactId: res.contactId || 0,
            amount: res.amount,
            type: res.type as FormValues["type"],
            notes: res.notes || "",
            mediaUri: res.mediaUri || "",
          });

          setOriginalMediaUri(res.mediaUri);
          setContactName(res.contactName || "");
        }
      } catch (error) {
        console.error(error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Terjadi kesalahan saat memuat data",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const onSubmit = async (data: FormValues) => {
    try {
      let finalMediaUri = data.mediaUri;

      if (data.mediaUri && data.mediaUri !== originalMediaUri) {
        if (data.mediaUri.startsWith("file://")) {
          finalMediaUri = await replaceFileOnDisk(originalMediaUri, data.mediaUri);
        }
      }

      await db
        .update(invoices)
        .set({
          entryDate: dayjs(data.entryDate).format("YYYY-MM-DD"),
          notes: data.notes,
          mediaUri: finalMediaUri,
        })
        .where(eq(invoices.id, Number(id)));

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: "Nota berhasil diperbarui",
      });

      router.back();
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Gagal!",
        text2: "Terjadi kesalahan saat menyimpan",
      });
    }
  };

  if (loading) {
    return (
      <Container>
        <Stack.Screen options={{ title: "Ubah Nota" }} />
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      </Container>
    );
  }

  return (
    <Container>
      <Stack.Screen options={{ title: "Ubah Nota" }} />
      <KeyboardAvoidingView style={styles.keyboardAvoiding} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: Spacing.lg + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Kode Nota</Text>
          <Controller
            control={control}
            name="code"
            render={({ field: { value } }) => (
              <View>
                <TextInput
                  style={[styles.input, styles.disabledInput, errors.code && styles.inputError]}
                  placeholder="Kode Nota"
                  value={value}
                  editable={false}
                />
              </View>
            )}
          />
          {errors.code && <Text style={styles.error}>{errors.code.message}</Text>}

          <Text style={styles.label}>Nama Kontak</Text>
          <Controller
            control={control}
            name="contactId"
            render={({ field: { value } }) => (
              <View>
                <TextInput
                  style={[styles.input, styles.disabledInput, errors.contactId && styles.inputError]}
                  placeholder="Nama Kontak"
                  value={contactName}
                  editable={false}
                />
              </View>
            )}
          />
          {errors.contactId && <Text style={styles.error}>{errors.contactId.message}</Text>}

          <Text style={styles.label}>Tanggal Nota</Text>
          <Controller
            control={control}
            name="entryDate"
            render={({ field: { onChange, value } }) => (
              <View>
                <Pressable onPress={() => setDatePickerVisibility(true)}>
                  <View pointerEvents="none">
                    <TextInput
                      style={[styles.input, errors.entryDate && styles.inputError]}
                      placeholder="Pilih Tanggal"
                      value={formatDate(value)}
                      editable={false}
                    />
                  </View>
                </Pressable>
                <DateTimePickerModal
                  isVisible={isDatePickerVisible}
                  mode="date"
                  date={value || new Date()}
                  onConfirm={(date) => {
                    onChange(date);
                    setDatePickerVisibility(false);
                  }}
                  onCancel={() => setDatePickerVisibility(false)}
                />
              </View>
            )}
          />
          {errors.entryDate && <Text style={styles.error}>{errors.entryDate.message}</Text>}

          <Text style={styles.label}>Tipe</Text>
          <Controller
            control={control}
            name="type"
            render={({ field: { value } }) => {
              const options = [
                { label: "Penjualan", value: "sales" },
                { label: "Pembelian", value: "purchase" },
              ];

              return (
                <Pressable style={[styles.input, styles.disabledInput, errors.type && styles.inputError]} disabled>
                  <Text style={{ color: Colors.border }}>
                    {value ? options.find((o) => o.value === value)?.label : "Pilih Tipe"}
                  </Text>
                </Pressable>
              );
            }}
          />
          {errors.type && <Text style={styles.error}>{errors.type.message}</Text>}

          <Text style={styles.label}>Jumlah (Rp.)</Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { value } }) => (
              <TextInput
                style={[styles.input, styles.disabledInput, errors.amount && styles.inputError]}
                placeholder="Masukkan Jumlah"
                value={formatNumber(value)}
                keyboardType="numeric"
                editable={false}
              />
            )}
          />
          {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}

          <Text style={styles.label}>Catatan (opsional)</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Catatan singkat"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                multiline
                numberOfLines={3}
              />
            )}
          />

          <Text style={styles.label}>Gambar (opsional)</Text>
          <Controller
            control={control}
            name="mediaUri"
            render={({ field: { onChange, value } }) => (
              <View>
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ["images"],
                      quality: image_compression_quality,
                    });
                    if (!result.canceled) {
                      onChange(result.assets[0].uri);
                    }
                  }}
                >
                  <Text>{value ? "Ubah Foto" : "Pilih Foto"}</Text>
                </TouchableOpacity>
                {value && (
                  <Pressable onPress={() => setPreviewImageUri(value)}>
                    <Image
                      source={{ uri: value }}
                      style={{ width: 120, height: 120, marginTop: 10, borderRadius: 8 }}
                    />
                  </Pressable>
                )}
              </View>
            )}
          />

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>Simpan</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!previewImageUri} transparent animationType="fade">
        <Pressable style={styles.photoOverlay} onPress={() => setPreviewImageUri(null)}>
          <Pressable style={styles.photoContainer} onPress={() => null}>
            {previewImageUri && (
              <Image source={{ uri: previewImageUri }} style={styles.photoImage} resizeMode="contain" />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: Spacing.sm,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  label: {
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  disabledInput: {
    backgroundColor: "#f5f5f5",
    opacity: 0.6,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
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
