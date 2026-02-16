import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts } from "@/db/schema";
import { yupResolver } from "@hookform/resolvers/yup";
import { eq } from "drizzle-orm";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import * as yup from "yup";

const schema = yup
  .object({
    name: yup.string().required("Nama wajib diisi"),
    phoneNumber: yup.string().nullable(),
    category: yup
      .string()
      .oneOf(["supplier", "client", "driver", "others"], "Kategori tidak valid")
      .required("Kategori wajib dipilih"),
    note: yup.string().nullable(),
  })
  .required();

type FormValues = yup.InferType<typeof schema>;

export default function ContactEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { name: "", phoneNumber: "", category: "client", note: "" },
  });

  useEffect(() => {
    const fetchContact = async () => {
      try {
        setLoading(true);
        const res = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, Number(id)))
          .get();

        if (res) {
          reset({
            name: res.name,
            phoneNumber: res.phoneNumber,
            category: res.category as FormValues["category"],
            note: res.notes || "",
          });
        }
      } catch (error) {
        console.error(error);
        Toast.show({
          type: "error",
          text1: "Gagal!",
          text2: "Terjadi kesalahan saat memuat data",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [id]);

  const onSubmit = async (data: FormValues) => {
    try {
      if (data.phoneNumber) {
        const existingContact = db.select().from(contacts).where(eq(contacts.phoneNumber, data.phoneNumber)).get();
        if (existingContact) {
          setError("phoneNumber", {
            type: "manual",
            message: "Nomor telepon sudah terdaftar a/n " + existingContact.name,
          });
          return;
        }

        if (!data.phoneNumber.match(/^\+?\d{6,15}$/)) {
          setError("phoneNumber", {
            type: "manual",
            message: "Nomor telepon tidak valid",
          });
          return;
        }
      }

      await db
        .update(contacts)
        .set({
          name: data.name,
          phoneNumber: data.phoneNumber || null,
          category: data.category,
          notes: data.note || null,
        })
        .where(eq(contacts.id, Number(id)));

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: "Kontak berhasil diperbarui",
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
        <Text>Loading...</Text>
      </Container>
    );
  }

  return (
    <Container>
      <Stack.Screen options={{ title: "Ubah Kontak" }} />
      <View style={styles.form}>
        <Text style={styles.label}>Nama</Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Nama lengkap"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              returnKeyType="next"
            />
          )}
        />
        {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}

        <Text style={styles.label}>Nomor Telepon</Text>
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.phoneNumber && styles.inputError]}
              placeholder="Nomor Telepon"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value || ""}
              keyboardType="phone-pad"
            />
          )}
        />
        {errors.phoneNumber && <Text style={styles.error}>{errors.phoneNumber.message}</Text>}

        <Text style={styles.label}>Kategori</Text>
        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, value } }) => {
            const options = [
              { label: "Supplier", value: "supplier" },
              { label: "Langganan", value: "client" },
              { label: "Supir", value: "driver" },
              { label: "Lainnya", value: "others" },
            ];

            return (
              <>
                <Pressable
                  style={[styles.input, errors.category && styles.inputError]}
                  onPress={() => setCategoryOpen((s) => !s)}
                >
                  <Text style={{ color: value ? Colors.text : Colors.border }}>
                    {value ? options.find((o) => o.value === value)?.label : "Pilih kategori"}
                  </Text>
                </Pressable>

                {categoryOpen && (
                  <View style={styles.dropdown}>
                    {options.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={styles.option}
                        onPress={() => {
                          onChange(opt.value);
                          setCategoryOpen(false);
                        }}
                      >
                        <Text>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            );
          }}
        />
        {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}

        <Text style={styles.label}>Catatan (opsional)</Text>
        <Controller
          control={control}
          name="note"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Catatan singkat"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value || ""}
              multiline
              numberOfLines={3}
            />
          )}
        />

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonText}>Simpan</Text>
        </Pressable>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: Spacing.sm,
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
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  option: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
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
});
