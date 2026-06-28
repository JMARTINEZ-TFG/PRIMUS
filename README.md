## Primus — Optimización Financiera Personal

Primus es una plataforma web de finanzas personales que centraliza, en un único tablero, la gestión de cuentas y obligaciones, la proyección de flujo de caja (cash flow), la comparación de opciones de financiación del mercado argentino y el seguimiento de alternativas de inversión.

> 🎓 Trabajo Final de Grado — Ingeniería en Software, Universidad Siglo 21 (2026).

🔗 Demo: https://primus-tfg.vercel.app

---

## 🔑 Acceso de Prueba (Demo)

> ⚠️ **Nota sobre el registro:** El alta de usuarios contempla la verificación por correo electrónico. En el entorno de demostración, el servicio de envío de correos (Resend) opera en **modo de prueba**, por lo que únicamente entrega mensajes a la casilla del titular del proyecto. Por dicho motivo, **un usuario nuevo no podrá completar la verificación** en la demostración pública.

A fin de acceder a la plataforma, se proporciona el siguiente usuario de prueba (previamente verificado):

| Usuario | Contraseña |
| ------- | ---------- |
| `test@test.com` | `Test1234!` |

> 💡 En un despliegue productivo esta limitación se elimina **verificando un dominio propio en Resend** y configurando el remitente (`from`) con una dirección de ese dominio, lo que habilita el envío a cualquier destinatario.

---

## 🚀 Características Principales

- **📊 Proyección de Cash Flow** — Permite estimar los ingresos y egresos mensuales y visualizar el saldo proyectado en tiempo real, con persistencia automática de los cambios.
- **💸 Gestión de Cuentas y Obligaciones** — Posibilita el registro de cuentas, ingresos recurrentes y obligaciones, a fin de obtener una visión integral de la situación financiera del usuario.
- **🏦 Comparador de Opciones de Financiación** — Préstamos personales de las principales entidades, ordenados por CFT, a partir de los datos del Régimen de Transparencia del BCRA.
- **📈 Comparador de Opciones de Inversión** — Consulta de tasas de referencia del mercado para Plazos Fijos, Cuentas Remuneradas y Fondos Comunes de Inversión.
- **🧾 Digitalización de Comprobantes (OCR)** — Permite cargar la imagen de un comprobante y extraer automáticamente sus datos.
- **🔐 Autenticación Segura** — Registro con verificación por correo electrónico, recuperación de contraseña, bloqueo por intentos fallidos y sesiones firmadas mediante JWT.

---

## 📖 Instalación

### Prerrequisitos

- Node.js ≥ 20
- Una base de datos PostgreSQL (por ejemplo, [Neon](https://neon.tech))
- Credenciales (API keys) de los servicios Resend, OCR y Prometeo (opcionales según la funcionalidad a utilizar)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/JMARTINEZ-TFG/PRIMUS.git
cd PRIMUS

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env y configurar las variables de entorno
#    Crear un archivo .env en la raíz del proyecto y completar las variables listadas en la tabla "Variables de Entorno" (más abajo)

# 4. Aplicar el esquema de la base de datos
#    Ejecutar src/lib/db/schema.sql y las migraciones en tu PostgreSQL

# 5. Levantar el entorno de desarrollo
npm run dev
```

### Variables de Entorno

| Variable                                              | Descripción                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | Connection string de PostgreSQL (Neon)                                                  |
| `JWT_SECRET`                                          | Secreto para firmar las sesiones JWT                                                    |
| `APP_URL`                                             | URL pública de la app (ej. `https://primus-tfg.vercel.app` o `https://localhost:8000/`) |
| `RESEND_API_KEY`                                      | API key de Resend (envío de emails)                                                     |
| `OCR_API_KEY`                                         | API key del servicio de OCR                                                             |
| `PROMETEO_API_KEY` / `PROMETEO_ENV` / `PROMETEO_MOCK` | Integración bancaria Prometeo                                                           |

---

## 📄 Licencia

Proyecto académico desarrollado en el marco del Trabajo Final de Grado. Uso educativo.

---

## 👨‍💻 Contacto

- **Autor:** Juan Manuel Martínez
- **Carrera:** Ingeniería en Software — Universidad Siglo 21
- **Legajo:** SOF-01986
- **Correo:** juanchimartinez7@gmail.com

---
