// Configuración de Supabase
const SUPABASE_URL = "https://vbfeygdfzzmqnljoxqjz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmV5Z2RmenptcW5sam94cWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzE4ODgsImV4cCI6MjA4NzA0Nzg4OH0.86fBqIBNHAsFnzxJUPnDz0Yx9FKfY34vCOJDrFmAQN8";

// Crear cliente Supabase (usamos "db" para no conflictar con el CDN)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
