import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { supabaseAdminGet } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface SupabasePaymentRow {
  id: string;
  ride_id?: string | null;
  amount: any;
  tip?: any;
  commission?: any;
  commission_rate_applied?: any;
  total?: any;
  payment_method?: string | null;
  payment_provider?: string | null;
  status?: string | null;
  commission_status?: string | null;
  local_transaction_id?: string | null;
  local_authorization_code?: string | null;
  local_bank?: string | null;
  notes?: string | null;
  cancel_reason?: string | null;
  synced_to_firebase?: boolean | null;
  firebase_synced_at?: string | null;
  biometric_authenticated?: boolean | null;
  biometric_type?: string | null;
  authentication_method?: string | null;
  sms_code_verified?: boolean | null;
  sms_verification_id?: string | null;
  paid_at?: string | null;
  commission_paid_at?: string | null;
  created_at?: string | null;
}

interface AdminPaymentRow {
  id: string;
  rideId: string | null;
  amount: number | null;
  tip: number | null;
  commission: number | null;
  commissionRateApplied: number | null;
  total: number | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  status: string | null;
  commissionStatus: string | null;
  localTransactionId: string | null;
  localAuthorizationCode: string | null;
  localBank: string | null;
  notes: string | null;
  cancelReason: string | null;
  syncedToFirebase: boolean;
  firebaseSyncedAt: string | null;
  biometricAuthenticated: boolean;
  biometricType: string | null;
  authenticationMethod: string | null;
  smsCodeVerified: boolean;
  smsVerificationId: string | null;
  paidAt: string | null;
  commissionPaidAt: string | null;
  createdAt: string | null;
}

function parseNumber(value: any): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const cmsDoc = await adminFirestore.doc(`cms-users/${uid}`).get();

    if (!cmsDoc.exists) {
      return NextResponse.json({ error: "No CMS access" }, { status: 403 });
    }

    const cmsData = cmsDoc.data() as { role?: string };

    if (cmsData.role !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden listar pagos" },
        { status: 403 }
      );
    }

    const search = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

    const supabasePayments = await supabaseAdminGet<SupabasePaymentRow>({
      table: "payments",
      select:
        "id,ride_id,amount,tip,commission,commission_rate_applied,total,payment_method,payment_provider,status,commission_status,local_transaction_id,local_authorization_code,local_bank,notes,cancel_reason,synced_to_firebase,firebase_synced_at,biometric_authenticated,biometric_type,authentication_method,sms_code_verified,sms_verification_id,paid_at,commission_paid_at,created_at",
      limit: 1000,
    });

    const rows: AdminPaymentRow[] = supabasePayments.map((p) => ({
      id: p.id,
      rideId: p.ride_id ?? null,
      amount: parseNumber(p.amount),
      tip: parseNumber(p.tip),
      commission: parseNumber(p.commission),
      commissionRateApplied: parseNumber(p.commission_rate_applied),
      total: parseNumber(p.total),
      paymentMethod: p.payment_method ?? null,
      paymentProvider: p.payment_provider ?? null,
      status: p.status ?? null,
      commissionStatus: p.commission_status ?? null,
      localTransactionId: p.local_transaction_id ?? null,
      localAuthorizationCode: p.local_authorization_code ?? null,
      localBank: p.local_bank ?? null,
      notes: p.notes ?? null,
      cancelReason: p.cancel_reason ?? null,
      syncedToFirebase: p.synced_to_firebase === true,
      firebaseSyncedAt: p.firebase_synced_at ?? null,
      biometricAuthenticated: p.biometric_authenticated === true,
      biometricType: p.biometric_type ?? null,
      authenticationMethod: p.authentication_method ?? null,
      smsCodeVerified: p.sms_code_verified === true,
      smsVerificationId: p.sms_verification_id ?? null,
      paidAt: p.paid_at ?? null,
      commissionPaidAt: p.commission_paid_at ?? null,
      createdAt: p.created_at ?? null,
    }));

    const filtered = search
      ? rows.filter((row) => {
          const haystack = [
            row.id,
            row.rideId,
            row.status,
            row.commissionStatus,
            row.paymentMethod,
            row.paymentProvider,
            row.localTransactionId,
            row.localAuthorizationCode,
            row.localBank,
            row.cancelReason,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : rows;

    return NextResponse.json({ payments: filtered });
  } catch (error: any) {
    console.error("[admin/payments] Error:", error);
    return NextResponse.json(
      { error: "Error interno al cargar pagos" },
      { status: 500 }
    );
  }
}
