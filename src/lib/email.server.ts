import { Resend } from "resend";

const client = new Resend(process.env.RESEND_API_KEY);

type SendOpts = { from: string; to: string; subject: string; html: string };

async function sendEmail(opts: SendOpts): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[resend] RESEND_API_KEY no está configurada");
    throw new Error("RESEND_API_KEY no está configurada");
  }
  const { data, error } = await client.emails.send(opts);
  if (error) {
    console.error("[resend] error al enviar email:", JSON.stringify(error), "-> to:", opts.to);
    throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`);
  }
  console.log("[resend] email enviado id:", data?.id, "-> to:", opts.to);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const base = process.env.APP_URL ?? "http://localhost:8080";
  const link = `${base}/reset-password?token=${token}`;

  await sendEmail({
    from: "Primus <onboarding@resend.dev>",
    to,
    subject: "Recuperá tu contraseña en Primus",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Recuperar contraseña</h2>
        <p style="color:#6b7280;margin-bottom:24px;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé clic en el botón para continuar.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">
          Restablecer contraseña
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          Este enlace expira en 1 hora. Si no solicitaste un cambio de contraseña, ignorá este mensaje.
        </p>
      </div>
    `,
  });
}

export async function sendUnlockApprovedEmail(to: string): Promise<void> {
  await sendEmail({
    from: "Primus <onboarding@resend.dev>",
    to,
    subject: "Tu cuenta fue desbloqueada en Primus",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Cuenta desbloqueada</h2>
        <p style="color:#6b7280;margin-bottom:24px;">
          Un administrador aprobó tu solicitud de blanqueo. Ya podés iniciar sesión con tu contraseña.
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          Si no solicitaste el desbloqueo de tu cuenta, contactá soporte de inmediato.
        </p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${base}/verify-email?token=${token}`;

  await sendEmail({
    from: "Primus <onboarding@resend.dev>",
    to,
    subject: "Confirmá tu cuenta en Primus",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Confirmá tu cuenta</h2>
        <p style="color:#6b7280;margin-bottom:24px;">
          Hacé clic en el botón para verificar tu dirección de correo y activar tu cuenta en Primus.
        </p>
        <a href="${link}"
           style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">
          Verificar cuenta
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
          Este enlace expira en 24 horas. Si no creaste una cuenta en Primus, ignorá este mensaje.
        </p>
      </div>
    `,
  });
}
