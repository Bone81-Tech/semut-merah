import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { GoogleSpreadsheet } from "https://esm.sh/google-spreadsheet@4.0.3";
import { JWT } from "https://esm.sh/google-auth-library@8.9.0";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ====== ENV VARS ======
const SERVICE_ACCOUNT_EMAIL = Deno.env.get("SERVICE_ACCOUNT_EMAIL")!;
const SERVICE_ACCOUNT_KEY = Deno.env.get("SERVICE_ACCOUNT_KEY")!;
const SHEET_ID = Deno.env.get("SHEET_ID")!;

// ====== CORS ======
const ALLOWED_ORIGINS = [
  "https://pasukansemutmerah.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "https://*.github.io"
];

// ====== SERVER ======
serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const url = new URL(req.url);
  const method = req.method;

  // Preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const doc = await connectSheet();

    // === GET /produk & GET /produk?id=xxx ===
    if (url.pathname === "/produk" && method === "GET") {
      const id = url.searchParams.get("id");
      const sheet = doc.sheetsByTitle["produk"];
      const rows = await sheet.getRows();
      const data = rows.map(r => r.toObject());

      if (id) {
        const found = data.find(p => p.id_produk == id);
        return jsonResponse(found ? { success: true, data: found } : { success: false, message: "Produk tidak ditemukan" }, origin);
      }
      return jsonResponse({ success: true, data }, origin);
    }

    // === POST /produk ===
    if (url.pathname === "/produk" && method === "POST") {
      const body = await req.json();
      if (!body.id_produk || !body.nama_produk) {
        return jsonResponse({ success: false, message: "id_produk dan nama_produk wajib diisi" }, origin, 400);
      }
      const sheet = doc.sheetsByTitle["produk"];
      await sheet.addRow(body);
      return jsonResponse({ success: true, message: "Produk ditambahkan" }, origin);
    }

    // === POST /register ===
    if (url.pathname === "/register" && method === "POST") {
      const body = await req.json();
      const { nama_lengkap, email, password, nomor_telepon } = body;

      // Validasi
      if (!nama_lengkap || !email || !password || !nomor_telepon) {
        return jsonResponse({ success: false, message: "Semua field wajib diisi" }, origin, 400);
      }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
        return jsonResponse({ success: false, message: "Format email tidak valid" }, origin, 400);
      }

      const sheet = doc.sheetsByTitle["Pengguna"];
      const rows = await sheet.getRows();
      if (rows.some(r => r.email === email)) {
        return jsonResponse({ success: false, message: "Email sudah terdaftar" }, origin, 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password);
      const newId = "user_" + Date.now();
      await sheet.addRow({ id: newId, nama_lengkap, email, password: hashedPassword, nomor_telepon });

      return jsonResponse({ success: true, message: "Registrasi berhasil", data: { id: newId, nama_lengkap, email, nomor_telepon } }, origin);
    }

    // === POST /login ===
    if (url.pathname === "/login" && method === "POST") {
      const body = await req.json();
      const { email, password } = body;

      if (!email || !password) {
        return jsonResponse({ success: false, message: "Email dan password wajib diisi" }, origin, 400);
      }

      const sheet = doc.sheetsByTitle["Pengguna"];
      const rows = await sheet.getRows();
      const user = rows.find(r => r.email === email);
      if (!user) return jsonResponse({ success: false, message: "Email tidak ditemukan" }, origin, 404);

      const match = await bcrypt.compare(password, user.password);
      if (!match) return jsonResponse({ success: false, message: "Password salah" }, origin, 401);

      const { password: _, ...safeUser } = user.toObject();
      return jsonResponse({ success: true, message: "Login berhasil", data: safeUser }, origin);
    }

    return jsonResponse({ success: false, message: "Endpoint tidak ditemukan" }, origin, 404);

  } catch (err) {
    return jsonResponse({ success: false, message: err.message }, origin, 500);
  }
});

// ====== HELPER ======
async function connectSheet() {
  const auth = new JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  return doc;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": isValidOrigin(origin) ? origin : "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "3600"
  };
}

function isValidOrigin(origin: string) {
  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed === "*") return true;
    if (allowed.includes("*")) {
      const regex = new RegExp("^" + allowed.replace(".", "\\.").replace("*", ".*") + "$");
      return regex.test(origin);
    }
    return origin === allowed;
  });
}

function jsonResponse(data: unknown, origin: string, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
  });
}
