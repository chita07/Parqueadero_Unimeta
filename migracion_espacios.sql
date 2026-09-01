-- =============================================
-- MIGRACIÓN SIMPLIFICADA: Solo un campo en pagos
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Agregar columna espacio_numero a la tabla pagos
-- (Si ya existe, ignorar el error)
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS espacio_numero INTEGER;
