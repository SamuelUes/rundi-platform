"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { fetchCmsUser } from "@/lib/cms-user";
import { themeColors } from "@/theme/colors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password
      );

      const user = credential.user;
      const cmsUser = await fetchCmsUser(user.uid);

      if (!cmsUser) {
        setError("No tienes acceso al CMS. Contacta a un administrador.");
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("cmsUser", JSON.stringify(cmsUser));
      }

      if (cmsUser.role === "admin") {
        router.push("/admin");
        return;
      }

      if (cmsUser.role === "operator") {
        router.push("/operator");
        return;
      }

      setError("Rol de usuario no válido para el CMS.");
    } catch (err) {
      setError("Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex min-h-screen items-center justify-center ${themeColors.appBackground}`}
    >
      <div className={`w-full max-w-md rounded-xl p-8 shadow-sm ${themeColors.surface}`}>
        <h1 className={`mb-6 text-2xl font-semibold ${themeColors.textPrimary}`}>
          Acceso al panel Rundi
        </h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label
              htmlFor="email"
              className={`block text-sm font-medium ${themeColors.textSecondary}`}
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${themeColors.surfaceBorder} ${themeColors.inputFocusBorder} ${themeColors.inputFocusRing}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className={`block text-sm font-medium ${themeColors.textSecondary}`}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${themeColors.surfaceBorder} ${themeColors.inputFocusBorder} ${themeColors.inputFocusRing}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className={`text-sm ${themeColors.dangerText}`} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${themeColors.buttonPrimaryBg} ${themeColors.buttonPrimaryHoverBg} ${themeColors.buttonPrimaryText}`}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
