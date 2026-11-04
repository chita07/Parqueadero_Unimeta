// Configuración de Supabase
const SUPABASE_URL = "https://vbfeygdfzzmqnljoxqjz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmV5Z2RmenptcW5sam94cWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzE4ODgsImV4cCI6MjA4NzA0Nzg4OH0.86fBqIBNHAsFnzxJUPnDz0Yx9FKfY34vCOJDrFmAQN8";

// Cliente remoto. Las operaciones del flujo de parqueadero pasan por parkingDB,
// que trabaja localmente y sincroniza con este cliente cuando hay internet.
const remoteDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const db = remoteDb; // Compatibilidad con los módulos antiguos.
window.remoteDb = remoteDb;
