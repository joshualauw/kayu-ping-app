import * as schema from "@/db/schema";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

export async function runSeed(db: ExpoSQLiteDatabase<typeof schema>) {
  const { faker } = await import("@faker-js/faker");

  console.log("🌱 Starting seed...");

  // Check if data already exists (idempotent)
  const existingContacts = await db.select().from(schema.contacts).limit(1);
  if (existingContacts.length > 0) {
    console.log("✅ Database already seeded. Skipping...");
    return;
  }

  // Seed Contacts (150 contacts across different categories)
  console.log("📇 Seeding contacts...");
  const contactCategories = ["supplier", "client", "driver", "others"];
  const contacts: { id: number; category: string }[] = [];

  for (let i = 0; i < 150; i++) {
    const category = faker.helpers.arrayElement(contactCategories);
    let name = "";

    // Generate realistic Indonesian business names based on category
    if (category === "supplier") {
      const supplierTypes = ["PT", "CV", "UD", "Toko"];
      const supplierNames = [
        "Sejahtera Makmur",
        "Jaya Abadi",
        "Berkah Rezeki",
        "Maju Bersama",
        "Cahaya Terang",
        "Sumber Rejeki",
        "Karya Mandiri",
        "Mulya Jaya",
        "Anugrah Sentosa",
        "Harapan Kita",
      ];
      name = `${faker.helpers.arrayElement(supplierTypes)} ${faker.helpers.arrayElement(supplierNames)} ${faker.number.int({ min: 1, max: 99 })}`;
    } else if (category === "client") {
      const clientTypes = ["PT", "CV", "UD", "Toko", "Warung"];
      const clientNames = [
        "Mitra Usaha",
        "Sinar Harapan",
        "Bintang Timur",
        "Rizki Barokah",
        "Makmur Jaya",
        "Lancar Selalu",
        "Prima Sentosa",
        "Sukses Bersama",
        "Gemilang Abadi",
        "Rejeki Nomplok",
      ];
      name = `${faker.helpers.arrayElement(clientTypes)} ${faker.helpers.arrayElement(clientNames)}`;
    } else if (category === "driver") {
      const firstNames = ["Budi", "Agus", "Slamet", "Bambang", "Joko", "Andi", "Hadi", "Rudi", "Dedi", "Eko"];
      const lastNames = [
        "Santoso",
        "Prasetyo",
        "Wibowo",
        "Susanto",
        "Hartono",
        "Kurniawan",
        "Setiawan",
        "Wijaya",
        "Gunawan",
        "Nugroho",
      ];
      name = `${faker.helpers.arrayElement(firstNames)} ${faker.helpers.arrayElement(lastNames)}`;
    } else {
      name = faker.company.name();
    }

    const phoneNumber = faker.helpers.maybe(() => `0${faker.string.numeric(9)}`, {
      probability: 0.7,
    });
    const notes = faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 });

    const result = await db
      .insert(schema.contacts)
      .values({
        name,
        phoneNumber,
        category,
        notes,
      })
      .returning({ id: schema.contacts.id });

    contacts.push({ id: result[0].id, category });
  }

  console.log(`✅ Created ${contacts.length} contacts`);

  // Seed Invoices (200 invoices)
  console.log("📄 Seeding invoices...");
  const invoiceTypes = ["sales", "purchase"];
  const invoices: { id: number; type: string; contactId: number; amount: number }[] = [];

  for (let i = 0; i < 200; i++) {
    const type = faker.helpers.arrayElement(invoiceTypes);

    // Match invoice type with appropriate contact category
    let eligibleContacts = contacts;
    if (type === "sales") {
      eligibleContacts = contacts.filter((c) => c.category === "client");
    } else if (type === "purchase") {
      eligibleContacts = contacts.filter((c) => c.category === "supplier");
    }

    const contact = faker.helpers.arrayElement(eligibleContacts);
    const entryDate = faker.date.between({
      from: "2024-01-01",
      to: "2026-02-20",
    });

    const dateStr = entryDate.toISOString().split("T")[0];
    const randomNum = faker.number.int({ min: 1000, max: 9999 });
    const code = `${type.toUpperCase().substring(0, 3)}-${dateStr.replace(/-/g, "")}-${randomNum}`;

    const amount = faker.number.int({ min: 100000, max: 50000000 }); // 100k to 50M IDR
    const notes = faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.4 });

    const result = await db
      .insert(schema.invoices)
      .values({
        code,
        entryDate: dateStr,
        contactId: contact.id,
        amount,
        type,
        notes,
        mediaUri: null,
      })
      .returning({ id: schema.invoices.id });

    invoices.push({ id: result[0].id, type, contactId: contact.id, amount });
  }

  console.log(`✅ Created ${invoices.length} invoices`);

  // Seed Payments (180 payments)
  console.log("💰 Seeding payments...");
  const paymentTypes = ["income", "expense"];
  const paymentMethods = ["cash", "bank_transfer", "others"];
  const payments: { id: number; type: string; contactId: number; amount: number }[] = [];

  for (let i = 0; i < 180; i++) {
    const type = faker.helpers.arrayElement(paymentTypes);

    // Match payment type with appropriate contact category
    let eligibleContacts = contacts;
    if (type === "income") {
      eligibleContacts = contacts.filter((c) => c.category === "client");
    } else if (type === "expense") {
      eligibleContacts = contacts.filter((c) => c.category === "supplier");
    }

    const contact = faker.helpers.arrayElement(eligibleContacts);
    const paymentDate = faker.date.between({
      from: "2024-01-01",
      to: "2026-02-20",
    });

    const dateStr = paymentDate.toISOString().split("T")[0];
    const method = faker.helpers.arrayElement(paymentMethods);
    const amount = faker.number.int({ min: 500000, max: 30000000 }); // 500k to 30M IDR
    const notes = faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 });

    const result = await db
      .insert(schema.payments)
      .values({
        paymentDate: dateStr,
        contactId: contact.id,
        amount,
        method,
        type,
        notes,
        mediaUri: null,
      })
      .returning({ id: schema.payments.id });

    payments.push({ id: result[0].id, type, contactId: contact.id, amount });
  }

  console.log(`✅ Created ${payments.length} payments`);

  // Seed Payment Allocations (create allocations for ~60% of payments)
  console.log("🔗 Seeding payment allocations...");
  let allocationCount = 0;

  for (const payment of payments) {
    // Skip some payments (40% remain unallocated)
    if (faker.datatype.boolean({ probability: 0.4 })) {
      continue;
    }

    // Find matching invoices for this payment
    const matchingInvoiceType = payment.type === "income" ? "sales" : "purchase";
    const eligibleInvoices = invoices.filter(
      (inv) => inv.contactId === payment.contactId && inv.type === matchingInvoiceType,
    );

    if (eligibleInvoices.length === 0) continue;

    // Allocate payment to 1-3 random invoices
    const numAllocations = faker.number.int({
      min: 1,
      max: Math.min(3, eligibleInvoices.length),
    });
    const selectedInvoices = faker.helpers.arrayElements(eligibleInvoices, numAllocations);

    let remainingAmount = payment.amount;

    for (let i = 0; i < selectedInvoices.length; i++) {
      if (remainingAmount <= 0) break;

      const invoice = selectedInvoices[i];
      let allocationAmount: number;

      if (i === selectedInvoices.length - 1) {
        // Last allocation gets remaining amount
        allocationAmount = Math.min(remainingAmount, invoice.amount);
      } else {
        // Random portion of remaining amount, but not more than invoice amount
        const maxAllocation = Math.min(remainingAmount, invoice.amount);
        allocationAmount = faker.number.int({
          min: Math.floor(maxAllocation * 0.3),
          max: maxAllocation,
        });
      }

      if (allocationAmount > 0) {
        await db.insert(schema.paymentAllocations).values({
          paymentId: payment.id,
          invoiceId: invoice.id,
          amount: allocationAmount,
        });

        remainingAmount -= allocationAmount;
        allocationCount++;
      }
    }
  }

  console.log(`✅ Created ${allocationCount} payment allocations`);

  // Summary
  console.log("\n🎉 Seed completed successfully!");
  console.log(`   📇 Contacts: ${contacts.length}`);
  console.log(`   📄 Invoices: ${invoices.length}`);
  console.log(`   💰 Payments: ${payments.length}`);
  console.log(`   🔗 Allocations: ${allocationCount}`);
}
