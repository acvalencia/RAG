import React, { useEffect, useRef, useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import MenuIcon from "@mui/icons-material/Menu";
import SendIcon from "@mui/icons-material/Send";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { askQuestion, ingestText, listDocuments } from "./api";

const drawerWidth = 288;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB per file
const ACCEPT =
  ".txt,.md,.markdown,.csv,.json,.jsonl,.log,.html,.htm,.xml,.yaml,.yml,.tsv,text/*";
const SUGGESTIONS = [
  "¿De qué tratan mis documentos?",
  "Hazme un resumen de lo que subí",
  "¿Cuáles son los puntos clave?",
];

let idCounter = 0;
const nextId = () => `${++idCounter}`;

function BrandAvatar({ size = 32 }) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: "primary.main",
        borderRadius: 2,
        fontSize: size > 36 ? 18 : 14,
        fontWeight: 800,
      }}
    >
      R
    </Avatar>
  );
}

const statusIcon = {
  reading: <CircularProgress size={14} />,
  embedding: <CircularProgress size={14} />,
  done: <CheckCircleOutlineIcon fontSize="small" sx={{ color: "primary.main" }} />,
  error: <ErrorOutlineIcon fontSize="small" color="error" />,
};
const statusLabel = {
  pending: "En cola",
  reading: "Leyendo…",
  embedding: "Generando embeddings…",
  done: "Indexado",
  error: "Error",
};

function Sidebar({
  documents,
  docsLoading,
  totals,
  uploads,
  onNewChat,
  onUploadClick,
  onClose,
  mobile,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "#f0efeb",
        p: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 44 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          {mobile && (
            <Tooltip title="Cerrar panel">
              <IconButton aria-label="Cerrar panel lateral" onClick={onClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <BrandAvatar />
          <Typography fontWeight={800}>RAG</Typography>
        </Stack>
        <Tooltip title="Nuevo chat">
          <IconButton aria-label="Nuevo chat" onClick={onNewChat}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Button
        fullWidth
        startIcon={<UploadFileIcon />}
        onClick={onUploadClick}
        sx={{
          justifyContent: "flex-start",
          mt: 1.5,
          mb: 2,
          minHeight: 42,
          color: "primary.contrastText",
          bgcolor: "primary.main",
          "&:hover": { bgcolor: "primary.dark" },
        }}
      >
        Subir documentos
      </Button>

      {uploads.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ px: 0.5 }}>
            Subida actual
          </Typography>
          <Stack spacing={0.75} sx={{ mt: 0.75 }}>
            {uploads.map((u) => (
              <Stack
                key={u.name}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 0.5 }}
              >
                <Box sx={{ display: "flex", width: 18, justifyContent: "center" }}>
                  {statusIcon[u.status] ?? null}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontSize={13} noWrap title={u.name}>
                    {u.name}
                  </Typography>
                  <Typography fontSize={11} color={u.status === "error" ? "error" : "text.secondary"} noWrap>
                    {u.status === "error"
                      ? u.error
                      : u.status === "done"
                        ? `${u.chunks} fragmento(s)`
                        : statusLabel[u.status]}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}

      <Box component="nav" aria-label="Base de conocimiento" sx={{ flex: 1, overflowY: "auto" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.25, py: 0.75 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={800}>
            Base de conocimiento
          </Typography>
          {docsLoading && <CircularProgress size={13} />}
        </Stack>

        {documents.length === 0 && !docsLoading ? (
          <Typography fontSize={13} color="text.secondary" sx={{ px: 1.25, py: 1 }}>
            Aún no hay documentos. Sube archivos de texto para indexarlos.
          </Typography>
        ) : (
          <List disablePadding>
            {documents.map((doc) => (
              <ListItemButton
                key={doc.source}
                disableRipple
                sx={{ minHeight: 44, px: 1.25, borderRadius: 2, cursor: "default", "&:hover": { bgcolor: "#e7e5df" } }}
              >
                <DescriptionOutlinedIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />
                <ListItemText
                  primary={doc.source}
                  secondary={`${doc.chunks} fragmento(s) · ${doc.tokens} tokens`}
                  primaryTypographyProps={{ noWrap: true, fontSize: 14 }}
                  secondaryTypographyProps={{ fontSize: 11.5 }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      <Divider sx={{ borderColor: "rgba(23, 23, 23, 0.08)", my: 1 }} />
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1, py: 0.5 }}>
        <CloudDoneOutlinedIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Box sx={{ textAlign: "left" }}>
          <Typography fontSize={13} fontWeight={800} lineHeight={1.2}>
            InsForge
          </Typography>
          <Typography fontSize={11.5} color="text.secondary" lineHeight={1.2}>
            {totals.documents} doc · {totals.chunks} fragmentos
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function ChatHeader({ onOpenSidebar, mobile }) {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(255, 255, 255, 0.92)",
        backdropFilter: "blur(16px)",
      }}
    >
      <Toolbar sx={{ minHeight: "60px !important", px: { xs: 1.5, sm: 2.25 } }}>
        {mobile && (
          <Tooltip title="Abrir panel">
            <IconButton aria-label="Abrir panel lateral" onClick={onOpenSidebar} sx={{ mr: 0.75 }}>
              <MenuIcon />
            </IconButton>
          </Tooltip>
        )}
        <Typography fontWeight={800} sx={{ px: 0.5 }}>
          RAG Assistant
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

function SourceChips({ sources, matches }) {
  if (!sources?.length) return null;
  const scoreBySource = new Map((matches ?? []).map((m) => [m.source, m.score]));
  return (
    <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, flexWrap: "wrap", gap: 0.75 }}>
      {sources.map((src) => {
        const score = scoreBySource.get(src);
        return (
          <Chip
            key={src}
            size="small"
            icon={<DescriptionOutlinedIcon />}
            label={score != null ? `${src} · ${score}` : src}
            variant="outlined"
            sx={{ borderColor: "#d8d7d2", bgcolor: "#fafaf8", maxWidth: 320 }}
          />
        );
      })}
    </Stack>
  );
}

function UserMessage({ content }) {
  return (
    <Stack alignItems="flex-end" sx={{ my: 1.75 }}>
      <Paper
        elevation={0}
        sx={{ maxWidth: { xs: "88%", sm: 560 }, px: 2, py: 1.5, borderRadius: 4.5, bgcolor: "#f0f2f4" }}
      >
        <Typography lineHeight={1.45} sx={{ whiteSpace: "pre-wrap" }}>
          {content}
        </Typography>
      </Paper>
    </Stack>
  );
}

function AssistantMessage({ message }) {
  const copy = () => navigator.clipboard?.writeText(message.content);
  return (
    <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ my: 2 }}>
      <BrandAvatar size={30} />
      <Box sx={{ maxWidth: 690, minWidth: 0 }}>
        <Typography
          lineHeight={1.65}
          color={message.error ? "error" : "text.primary"}
          sx={{ whiteSpace: "pre-wrap" }}
        >
          {message.content}
        </Typography>
        <SourceChips sources={message.sources} matches={message.matches} />
        {!message.error && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            <Tooltip title="Copiar respuesta">
              <IconButton size="small" aria-label="Copiar respuesta" onClick={copy}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function SystemMessage({ content }) {
  return (
    <Stack alignItems="center" sx={{ my: 1.5 }}>
      <Chip size="small" label={content} sx={{ bgcolor: "#f0efeb", color: "text.secondary", maxWidth: "90%" }} />
    </Stack>
  );
}

function ThinkingMessage() {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ my: 2 }}>
      <BrandAvatar size={30} />
      <Stack direction="row" alignItems="center" spacing={1}>
        <CircularProgress size={16} />
        <Typography color="text.secondary">Buscando en tus documentos…</Typography>
      </Stack>
    </Stack>
  );
}

function EmptyState({ hasDocuments, onSuggestion }) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ mt: { xs: 4, sm: 8 } }}>
      <BrandAvatar size={46} />
      <Typography
        component="h1"
        sx={{ textAlign: "center", fontSize: { xs: "1.9rem", sm: "2.5rem" }, fontWeight: 800, lineHeight: 1.1 }}
      >
        ¿En qué puedo ayudarte?
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 520, textAlign: "center" }}>
        {hasDocuments
          ? "Pregunta sobre tus documentos. Responderé solo con la información indexada."
          : "Sube archivos de texto (arrástralos aquí o usa 📎) para indexarlos y luego pregunta sobre ellos."}
      </Typography>
      {hasDocuments && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
            gap: 1.25,
            width: "100%",
            maxWidth: 680,
            mt: 2,
          }}
        >
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              variant="outlined"
              onClick={() => onSuggestion(s)}
              sx={{
                justifyContent: "flex-start",
                minHeight: 52,
                px: 1.75,
                color: "text.primary",
                borderColor: "#d8d7d2",
                fontWeight: 500,
                textAlign: "left",
                "&:hover": { borderColor: "#b9b8b2", bgcolor: "#fafaf8" },
              }}
            >
              {s}
            </Button>
          ))}
        </Box>
      )}
    </Stack>
  );
}

function Composer({ input, setInput, onSend, onUploadClick, asking }) {
  const submit = (e) => {
    e.preventDefault();
    onSend();
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };
  return (
    <Box
      component="footer"
      sx={{ width: "100%", maxWidth: 820, mx: "auto", px: { xs: 1.5, sm: 3 }, pb: { xs: 2, sm: 2.5 } }}
    >
      <Paper
        component="form"
        elevation={0}
        onSubmit={submit}
        sx={{
          display: "grid",
          gridTemplateColumns: "36px minmax(0, 1fr) 36px",
          alignItems: "end",
          gap: 1,
          p: 1.25,
          border: "1px solid rgba(23, 23, 23, 0.1)",
          borderRadius: 6,
          boxShadow: "0 18px 55px rgba(23, 23, 23, 0.08)",
        }}
        aria-label="Enviar mensaje"
      >
        <Tooltip title="Adjuntar archivos">
          <IconButton aria-label="Adjuntar archivos" onClick={onUploadClick}>
            <AttachFileIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <TextField
          multiline
          maxRows={6}
          minRows={1}
          placeholder="Pregunta sobre tus documentos"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{ "& .MuiInputBase-root": { py: 0.5, alignItems: "center", lineHeight: 1.45 } }}
        />
        <Tooltip title="Enviar">
          <span>
            <IconButton
              type="submit"
              aria-label="Enviar mensaje"
              disabled={asking || !input.trim()}
              sx={{
                bgcolor: "primary.main",
                color: "primary.contrastText",
                borderRadius: "50%",
                "&:hover": { bgcolor: "primary.dark" },
                "&.Mui-disabled": { bgcolor: "#d8d7d2", color: "#fff" },
              }}
            >
              {asking ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1 }}>
        Las respuestas se basan únicamente en los documentos indexados.
      </Typography>
    </Box>
  );
}

export default function App() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [totals, setTotals] = useState({ documents: 0, chunks: 0 });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);

  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);
  const endRef = useRef(null);

  const refreshDocuments = async () => {
    setDocsLoading(true);
    try {
      const res = await listDocuments();
      setDocuments(res.documents ?? []);
      setTotals({ documents: res.total_documents ?? 0, chunks: res.total_chunks ?? 0 });
    } catch (err) {
      // Keep the app usable even if the list can't load.
      console.error("No se pudo cargar la base de conocimiento:", err.message);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    refreshDocuments();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  const pushMessage = (msg) => setMessages((prev) => [...prev, { id: nextId(), ...msg }]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setUploads(files.map((f) => ({ name: f.name, status: "pending", chunks: 0 })));
    const setStatus = (i, patch) =>
      setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));

    let ok = 0;
    let totalChunks = 0;
    const failed = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.size > MAX_BYTES) throw new Error("supera 2 MB");
        setStatus(i, { status: "reading" });
        const text = await file.text();
        if (!text.trim()) throw new Error("archivo vacío");
        if (text.includes("\u0000")) throw new Error("binario no soportado (sube texto)");
        setStatus(i, { status: "embedding" });
        const result = await ingestText(text, file.name);
        const chunks = result.chunks_inserted ?? 0;
        setStatus(i, { status: "done", chunks });
        ok += 1;
        totalChunks += chunks;
      } catch (err) {
        setStatus(i, { status: "error", error: err.message });
        failed.push(`${file.name} (${err.message})`);
      }
    }

    await refreshDocuments();

    const parts = [];
    if (ok > 0) parts.push(`Indexé ${ok} archivo(s) en ${totalChunks} fragmento(s).`);
    if (failed.length) parts.push(`No se pudieron procesar: ${failed.join(", ")}.`);
    pushMessage({ role: "system", content: parts.join(" ") });

    // Clear the finished batch after a short delay so the user sees the result.
    setTimeout(() => setUploads([]), 4000);
  };

  const onFileInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = ""; // allow re-selecting the same file
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const runQuestion = async (q) => {
    const question = q.trim();
    if (!question || asking) return;
    setInput("");
    pushMessage({ role: "user", content: question });
    setAsking(true);
    try {
      const res = await askQuestion(question);
      pushMessage({
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        matches: res.matches,
      });
    } catch (err) {
      pushMessage({ role: "assistant", content: `Error: ${err.message}`, error: true });
    } finally {
      setAsking(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  const sidebarProps = {
    documents,
    docsLoading,
    totals,
    uploads,
    onNewChat: () => setMessages([]),
    onUploadClick: openFilePicker,
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.paper" }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={onFileInputChange}
        style={{ display: "none" }}
      />

      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          borderRight: "1px solid",
          borderColor: "divider",
        }}
      >
        <Sidebar {...sidebarProps} onClose={() => {}} mobile={false} />
      </Box>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: "min(86vw, 320px)", borderRadius: 0 } }}
      >
        <Sidebar {...sidebarProps} onClose={() => setDrawerOpen(false)} mobile={mobile} />
      </Drawer>

      <Box
        sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, minHeight: "100vh", position: "relative" }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <ChatHeader onOpenSidebar={() => setDrawerOpen(true)} mobile={mobile} />

        {uploads.some((u) => u.status === "reading" || u.status === "embedding") && (
          <LinearProgress />
        )}

        <Box sx={{ flex: 1, overflowY: "auto" }}>
          <Box
            component="section"
            aria-label="Chat principal"
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: 820,
              mx: "auto",
              px: { xs: 2, sm: 3 },
              pt: { xs: 2, sm: 3 },
              pb: 3,
            }}
          >
            {messages.length === 0 ? (
              <EmptyState hasDocuments={documents.length > 0} onSuggestion={runQuestion} />
            ) : (
              messages.map((m) => {
                if (m.role === "user") return <UserMessage key={m.id} content={m.content} />;
                if (m.role === "system") return <SystemMessage key={m.id} content={m.content} />;
                return <AssistantMessage key={m.id} message={m} />;
              })
            )}
            {asking && <ThinkingMessage />}
            <div ref={endRef} />
          </Box>
        </Box>

        <Composer
          input={input}
          setInput={setInput}
          onSend={() => runQuestion(input)}
          onUploadClick={openFilePicker}
          asking={asking}
        />

        {dragging && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(31, 122, 100, 0.08)",
              border: "2px dashed",
              borderColor: "primary.main",
              pointerEvents: "none",
            }}
          >
            <Stack alignItems="center" spacing={1}>
              <UploadFileIcon sx={{ fontSize: 40, color: "primary.main" }} />
              <Typography fontWeight={700} color="primary.main">
                Suelta los archivos para indexarlos
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}
