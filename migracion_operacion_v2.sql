-- ============================================================
-- UNIPARKING - Operación por entrada/salida y modo offline
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- La tarifa por hora queda desactivada, pero no se borran históricos.
UPDATE tarifas SET activo = false WHERE tipo_servicio = 'hora';

-- Clientes separados de la autenticación administrativa.
CREATE TABLE IF NOT EXISTS parqueadero_clientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              TEXT NOT NULL,
    cedula              TEXT NOT NULL UNIQUE,
    telefono            TEXT,
    correo              TEXT,
    es_estudiante       BOOLEAN NOT NULL DEFAULT false,
    programa_academico  TEXT,
    codigo_laboral      TEXT,
    tipo_usuario        TEXT NOT NULL DEFAULT 'particular'
                        CHECK (tipo_usuario IN ('estudiante', 'trabajador_universidad', 'particular', 'visitante')),
    area_trabajo        TEXT,
    cargo               TEXT,
    device_id           TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lista autorizada de trabajadores exentos. Nunca se debe inferir la exención
-- solamente a partir de lo que escriba el visitante.
CREATE TABLE IF NOT EXISTS parqueadero_trabajadores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              TEXT NOT NULL,
    cedula              TEXT NOT NULL UNIQUE,
    codigo_laboral      TEXT,
    area_trabajo        TEXT NOT NULL,
    cargo               TEXT,
    placa_autorizada    TEXT,
    telefono            TEXT,
    correo              TEXT,
    activo              BOOLEAN NOT NULL DEFAULT true,
    fecha_inicio        DATE DEFAULT CURRENT_DATE,
    fecha_fin           DATE,
    aprobado_por        TEXT,
    device_id           TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parqueadero_servicios (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id          UUID REFERENCES parqueadero_clientes(id) ON DELETE SET NULL,
    placa               TEXT NOT NULL,
    tipo_plan           TEXT NOT NULL CHECK (tipo_plan IN ('diario', 'semanal', 'mensual', 'exento')),
    creado_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vigente_desde       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vigente_hasta       TIMESTAMPTZ NOT NULL,
    exento_cobro        BOOLEAN NOT NULL DEFAULT false,
    cobro_generado      BOOLEAN NOT NULL DEFAULT false,
    valor_servicio      INTEGER NOT NULL DEFAULT 0,
    pagado_at           TIMESTAMPTZ,
    metodo_pago         TEXT,
    estado              TEXT NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo', 'cerrado', 'cancelado')),
    motivo_exencion     TEXT,
    device_id           TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parqueadero_estancias (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servicio_id                 UUID REFERENCES parqueadero_servicios(id) ON DELETE SET NULL,
    cliente_id                  UUID REFERENCES parqueadero_clientes(id) ON DELETE SET NULL,
    ticket_entrada              TEXT NOT NULL UNIQUE,
    ticket_salida               TEXT UNIQUE,
    placa                       TEXT NOT NULL,
    nombre                      TEXT NOT NULL,
    cedula                      TEXT NOT NULL,
    telefono                    TEXT,
    correo                      TEXT,
    es_estudiante               BOOLEAN NOT NULL DEFAULT false,
    programa_academico          TEXT,
    tipo_usuario                TEXT NOT NULL DEFAULT 'particular',
    area_trabajo                TEXT,
    cargo                       TEXT,
    codigo_laboral              TEXT,
    exento_cobro                BOOLEAN NOT NULL DEFAULT false,
    plan                        TEXT NOT NULL DEFAULT 'diario',
    espacio_numero              INTEGER NOT NULL,
    entrada_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    salida_at                   TIMESTAMPTZ,
    horas_uso                   NUMERIC(10,2),
    valor_cobrado               INTEGER NOT NULL DEFAULT 0,
    estado                      TEXT NOT NULL DEFAULT 'abierta'
                                CHECK (estado IN ('abierta', 'cerrada', 'anulada')),
    estado_pago                 TEXT NOT NULL DEFAULT 'pendiente_salida'
                                CHECK (estado_pago IN ('pendiente_salida', 'pagado', 'exento', 'sin_cobro_reingreso')),
    motivo_exencion             TEXT,
    metodo_pago                 TEXT,
    ticket_entrada_generado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ticket_salida_generado_at   TIMESTAMPTZ,
    device_id                   TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parqueadero_estancias_placa ON parqueadero_estancias(placa);
CREATE INDEX IF NOT EXISTS idx_parqueadero_estancias_entrada ON parqueadero_estancias(entrada_at);
CREATE INDEX IF NOT EXISTS idx_parqueadero_estancias_abiertas ON parqueadero_estancias(estado, salida_at);
CREATE INDEX IF NOT EXISTS idx_parqueadero_trabajadores_activos ON parqueadero_trabajadores(cedula, activo);
CREATE INDEX IF NOT EXISTS idx_parqueadero_servicios_vigencia ON parqueadero_servicios(placa, vigente_hasta);

-- Actualización automática de marcas de modificación.
CREATE OR REPLACE FUNCTION parqueadero_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_updated_at ON parqueadero_clientes;
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON parqueadero_clientes
FOR EACH ROW EXECUTE FUNCTION parqueadero_touch_updated_at();
DROP TRIGGER IF EXISTS trg_trabajadores_updated_at ON parqueadero_trabajadores;
CREATE TRIGGER trg_trabajadores_updated_at BEFORE UPDATE ON parqueadero_trabajadores
FOR EACH ROW EXECUTE FUNCTION parqueadero_touch_updated_at();
DROP TRIGGER IF EXISTS trg_servicios_updated_at ON parqueadero_servicios;
CREATE TRIGGER trg_servicios_updated_at BEFORE UPDATE ON parqueadero_servicios
FOR EACH ROW EXECUTE FUNCTION parqueadero_touch_updated_at();
DROP TRIGGER IF EXISTS trg_estancias_updated_at ON parqueadero_estancias;
CREATE TRIGGER trg_estancias_updated_at BEFORE UPDATE ON parqueadero_estancias
FOR EACH ROW EXECUTE FUNCTION parqueadero_touch_updated_at();

-- Políticas temporales compatibles con el frontend actual. En una siguiente
-- etapa deben reemplazarse por Supabase Auth y permisos por rol.
ALTER TABLE parqueadero_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parqueadero_trabajadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE parqueadero_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE parqueadero_estancias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parqueadero_clientes_anon" ON parqueadero_clientes;
CREATE POLICY "parqueadero_clientes_anon" ON parqueadero_clientes FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "parqueadero_trabajadores_anon" ON parqueadero_trabajadores;
CREATE POLICY "parqueadero_trabajadores_anon" ON parqueadero_trabajadores FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "parqueadero_servicios_anon" ON parqueadero_servicios;
CREATE POLICY "parqueadero_servicios_anon" ON parqueadero_servicios FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "parqueadero_estancias_anon" ON parqueadero_estancias;
CREATE POLICY "parqueadero_estancias_anon" ON parqueadero_estancias FOR ALL TO anon USING (true) WITH CHECK (true);

-- Tarifa oficial mínima de salida.
INSERT INTO tarifas (tipo_servicio, nombre_display, precio, descripcion, activo)
VALUES ('diario', 'Diario', 2000, 'Cobro mínimo por servicio y día', true)
ON CONFLICT (tipo_servicio) DO UPDATE SET activo = true, descripcion = EXCLUDED.descripcion;
