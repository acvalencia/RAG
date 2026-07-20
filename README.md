# RAG Chat App (InsForge BaaS)

Esta es una aplicación de chat **RAG (Retrieval-Augmented Generation)** que permite a los usuarios subir documentos, generar incrustaciones (embeddings) automáticas y chatear con su contenido utilizando modelos de lenguaje integrados.

La aplicación utiliza un frontend moderno en **React + Vite + Material-UI (MUI)** y un backend serverless potenciado por **[InsForge](https://insforge.dev)**.

---

## 🚀 Requisitos Previos

Asegúrate de tener instalado en tu máquina:
- **Node.js** (v18 o superior recomendado)
- **pnpm** (administrador de paquetes)
- **InsForge CLI** para la gestión del backend

---

## 🛠️ Configuración e Instalación

### 1. Clonar e Instalar Dependencias

Instala los paquetes necesarios en el frontend:

```bash
pnpm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de plantilla `.env.example` a un archivo local `.env.local` (el cual está ignorado en git):

```bash
cp .env.example .env.local
```

Abre `.env.local` y configura las variables:
- `VITE_INSFORGE_API_URL`: URL base de la API de tu proyecto en InsForge.
- `OPENROUTER_API_KEY`: Tu clave API de OpenRouter (necesaria para el backend).

---

## ⚡ Conectarse a InsForge (Backend)

Para interactuar con el backend de **InsForge**, puedes iniciar sesión y vincular el proyecto local con los comandos de la CLI. 

> [!NOTE]
> Revisa el archivo [notes.md](file:///Users/camilo/lab/RAG/notes.md) para más detalles sobre las credenciales específicas del proyecto.

### Iniciar Sesión en InsForge:
```bash
npx @insforge/cli login --user-api-key <TU_USER_API_KEY>
```

### Vincular el Proyecto Local:
```bash
npx @insforge/cli link --project-id 471790bf-71e5-4a82-9476-8fd206775673
```

---

## 💻 Desarrollo Local

Para iniciar el servidor de desarrollo del frontend con Vite:

```bash
pnpm dev
```

El servidor estará disponible en http://localhost:5173 (o la dirección que muestre la consola).

---

## 📁 Estructura del Proyecto

- `src/main.jsx`: Punto de entrada de la aplicación.
- `src/App.jsx`: Componente principal que maneja la interfaz de usuario (historial de chat, carga de archivos, barra lateral de documentos).
- `src/api.js`: Cliente ligero para comunicarse con las Edge Functions de InsForge (`ingest`, `ask`, `documents`).
- `functions/`: Código del lado del servidor (Edge Functions) para la ingesta de texto y resolución de preguntas.
- `migrations/`: Migraciones de base de datos para la base de datos PostgreSQL en InsForge.
