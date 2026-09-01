-- ============================================================
-- MIGRACIÓN: Objetivo 4 — Prototipo de Reconocimiento de Placas (ANPR)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS alertas_acceso (
    id              SERIAL PRIMARY KEY,
    placa_detectada TEXT NOT NULL,          -- Lo que el OCR leyó
    placa_corregida TEXT,                   -- Placa corregida manualmente (si aplica)
    tiene_pago      BOOLEAN DEFAULT FALSE,  -- ¿Tenía pago vigente al momento del escaneo?
    pago_id         INTEGER REFERENCES pagos(id) ON DELETE SET NULL,
    nombre_usuario  TEXT,                   -- Nombre del titular si se encontró pago
    tipo_servicio   TEXT,                   -- Plan del pago (hora, diario, semanal, mensual)
    metodo_captura  TEXT DEFAULT 'camara',  -- 'camara' o 'archivo'
    confianza_ocr   TEXT,                   -- Nivel de confianza reportado por Tesseract
    atendida        BOOLEAN DEFAULT FALSE,  -- ¿El admin ya revisó esta alerta?
    fecha_hora      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE alertas_acceso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SELECT alertas_acceso" ON alertas_acceso FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT alertas_acceso" ON alertas_acceso FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE alertas_acceso" ON alertas_acceso FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE alertas_acceso" ON alertas_acceso FOR DELETE TO anon USING (true);

-- Índices de búsqueda
CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON alertas_acceso(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_alertas_placa ON alertas_acceso(placa_detectada);
