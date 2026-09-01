-- ============================================================
-- SCRIPT CONSOLIDADO — Parqueadero UNIMETA
-- Objetivos 3, 4, 5 y 6
-- 
-- INSTRUCCIONES:
-- 1. Abre tu proyecto en https://supabase.com
-- 2. Ve a "SQL Editor" en el menú izquierdo
-- 3. Pega TODO este contenido y haz clic en "Run"
-- ============================================================

-- ===========================
-- OBJETIVO 1 & 2 (Base)
-- ===========================

CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    cedula      TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE,
    telefono    TEXT,
    password    TEXT NOT NULL,
    rol         TEXT DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SELECT usuarios" ON usuarios;
DROP POLICY IF EXISTS "INSERT usuarios" ON usuarios;
DROP POLICY IF EXISTS "UPDATE usuarios" ON usuarios;
DROP POLICY IF EXISTS "DELETE usuarios" ON usuarios;
CREATE POLICY "SELECT usuarios"  ON usuarios FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT usuarios"  ON usuarios FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE usuarios"  ON usuarios FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE usuarios"  ON usuarios FOR DELETE TO anon USING (true);

INSERT INTO usuarios (nombre, cedula, email, password, rol)
VALUES ('Administrador Parqueadero', '0000000000', 'admin@unimeta.edu.co', 'admin123', 'admin')
ON CONFLICT (cedula) DO NOTHING;

CREATE TABLE IF NOT EXISTS tarifas (
    id              SERIAL PRIMARY KEY,
    tipo_servicio   TEXT UNIQUE NOT NULL,
    nombre_display  TEXT NOT NULL,
    precio          INTEGER NOT NULL,
    descripcion     TEXT,
    activo          BOOLEAN DEFAULT true,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tarifas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SELECT tarifas" ON tarifas;
DROP POLICY IF EXISTS "UPDATE tarifas" ON tarifas;
DROP POLICY IF EXISTS "INSERT tarifas" ON tarifas;
CREATE POLICY "SELECT tarifas" ON tarifas FOR SELECT TO anon USING (true);
CREATE POLICY "UPDATE tarifas" ON tarifas FOR UPDATE TO anon USING (true);
CREATE POLICY "INSERT tarifas" ON tarifas FOR INSERT TO anon WITH CHECK (true);

INSERT INTO tarifas (tipo_servicio, nombre_display, precio, descripcion) VALUES
('hora',    'Por Hora',  1500,  'Tarifa flexible por hora real de permanencia'),
('diario',  'Diario',    2000,  'Acceso por un día completo'),
('semanal', 'Semanal',   10000, 'Acceso por 7 días corridos'),
('mensual', 'Mensual',   45000, 'Acceso por un mes calendario')
ON CONFLICT (tipo_servicio) DO UPDATE
    SET nombre_display = EXCLUDED.nombre_display,
        precio         = EXCLUDED.precio,
        descripcion    = EXCLUDED.descripcion,
        updated_at     = NOW();

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS fecha_salida TIMESTAMPTZ;
ALTER TABLE pagos    ADD COLUMN IF NOT EXISTS horas_estimadas INTEGER;

CREATE INDEX IF NOT EXISTS idx_pagos_fecha_inicio ON pagos(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_checkins_fecha_salida ON checkins(fecha_salida);


-- ===========================
-- OBJETIVO 3 — Trazabilidad
-- ===========================

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado_verificacion TEXT DEFAULT 'verificado';
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;


-- ===========================
-- OBJETIVO 5 — Cesiones
-- ===========================

CREATE TABLE IF NOT EXISTS cesiones_plaza (
    id                  SERIAL PRIMARY KEY,
    pago_id             INTEGER REFERENCES pagos(id) ON DELETE CASCADE,
    placa_mensualista   TEXT NOT NULL,
    nombre_mensualista  TEXT,
    espacio_numero      INTEGER,
    fecha_ausencia      DATE NOT NULL DEFAULT CURRENT_DATE,
    jornada             TEXT NOT NULL CHECK (jornada IN ('diurna', 'nocturna', 'ambas')),
    placa_beneficiario  TEXT,
    estado              TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'usada', 'cancelada')),
    observacion         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cesiones_plaza ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SELECT cesiones" ON cesiones_plaza;
DROP POLICY IF EXISTS "INSERT cesiones" ON cesiones_plaza;
DROP POLICY IF EXISTS "UPDATE cesiones" ON cesiones_plaza;
DROP POLICY IF EXISTS "DELETE cesiones" ON cesiones_plaza;
CREATE POLICY "SELECT cesiones" ON cesiones_plaza FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT cesiones" ON cesiones_plaza FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE cesiones" ON cesiones_plaza FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE cesiones" ON cesiones_plaza FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_cesiones_fecha ON cesiones_plaza(fecha_ausencia);
CREATE INDEX IF NOT EXISTS idx_cesiones_placa ON cesiones_plaza(placa_mensualista);


-- ===========================
-- OBJETIVO 6 — Reservas
-- ===========================

CREATE TABLE IF NOT EXISTS reservas (
    id              SERIAL PRIMARY KEY,
    pago_id         INTEGER REFERENCES pagos(id) ON DELETE CASCADE,
    placa           TEXT NOT NULL,
    espacio_numero  INTEGER NOT NULL,
    fecha_reserva   DATE NOT NULL DEFAULT CURRENT_DATE,
    jornada         TEXT NOT NULL,
    estado          TEXT DEFAULT 'reservada' CHECK (estado IN ('reservada', 'completada', 'cancelada')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SELECT reservas" ON reservas;
DROP POLICY IF EXISTS "INSERT reservas" ON reservas;
DROP POLICY IF EXISTS "UPDATE reservas" ON reservas;
DROP POLICY IF EXISTS "DELETE reservas" ON reservas;
CREATE POLICY "SELECT reservas" ON reservas FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT reservas" ON reservas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE reservas" ON reservas FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE reservas" ON reservas FOR DELETE TO anon USING (true);


-- ===========================
-- OBJETIVO 4 — Alertas ANPR
-- ===========================

CREATE TABLE IF NOT EXISTS alertas_acceso (
    id              SERIAL PRIMARY KEY,
    placa_detectada TEXT NOT NULL,
    placa_corregida TEXT,
    tiene_pago      BOOLEAN DEFAULT FALSE,
    pago_id         INTEGER REFERENCES pagos(id) ON DELETE SET NULL,
    nombre_usuario  TEXT,
    tipo_servicio   TEXT,
    metodo_captura  TEXT DEFAULT 'camara',
    confianza_ocr   TEXT,
    atendida        BOOLEAN DEFAULT FALSE,
    fecha_hora      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE alertas_acceso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SELECT alertas_acceso" ON alertas_acceso;
DROP POLICY IF EXISTS "INSERT alertas_acceso" ON alertas_acceso;
DROP POLICY IF EXISTS "UPDATE alertas_acceso" ON alertas_acceso;
DROP POLICY IF EXISTS "DELETE alertas_acceso" ON alertas_acceso;
CREATE POLICY "SELECT alertas_acceso" ON alertas_acceso FOR SELECT TO anon USING (true);
CREATE POLICY "INSERT alertas_acceso" ON alertas_acceso FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "UPDATE alertas_acceso" ON alertas_acceso FOR UPDATE TO anon USING (true);
CREATE POLICY "DELETE alertas_acceso" ON alertas_acceso FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON alertas_acceso(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_alertas_placa ON alertas_acceso(placa_detectada);
