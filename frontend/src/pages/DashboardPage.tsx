// src/pages/DashboardPage.tsx
// Sprint S06-6.4 — Dashboard y visualización de precios actuales

import { useEffect, useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
  type SortingState,
} from '@tanstack/react-table';
import {
  AlertTriangle,
  Bell,
  Camera,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  RefreshCw,
  ShieldAlert,
  Store,
} from 'lucide-react';

import {
  fetchDashboardSummary,
  fetchPriceRows,
  getUniqueProducts,
} from '../services/dashboardService';
import type {
  DashboardFilters,
  DashboardSummary,
  FilterStatus,
  PriceRow,
  PriceStatus,
} from '../types/dashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS: Record<PriceStatus, { label: string; bg: string; text: string; border: string }> = {
  ok:       { label: 'OK',        bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  warning:  { label: 'Alerta',    bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  critical: { label: 'Crítico',   bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  unknown:  { label: 'Sin datos', bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
};

function StatusBadge({ status }: { status: PriceStatus }) {
  const s = STATUS[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        letterSpacing: '0.02em',
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Diff cell ────────────────────────────────────────────────────────────────

function DiffCell({ value }: { value: number }) {
  if (value === 0) return <span style={{ color: '#94a3b8', fontFamily: 'monospace' }}>—</span>;
  const isCrit  = value <= -10;
  const isWarn  = value < 0 && !isCrit;
  const isAbove = value > 0;
  const color = isCrit ? '#dc2626' : isWarn ? '#d97706' : isAbove ? '#7c3aed' : '#16a34a';
  const bg    = isCrit ? '#fef2f2' : isWarn ? '#fffbeb' : isAbove ? '#f5f3ff' : '#f0fdf4';
  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 4,
        background: bg,
        color,
      }}
    >
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

interface CardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  danger?: boolean;
}

function SummaryCard({ icon, label, value, danger }: CardProps) {
  const isRed = danger && value > 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
        background: isRed ? '#fff5f5' : '#ffffff',
        border: `1px solid ${isRed ? '#fecaca' : '#e2e8f0'}`,
        borderRadius: 12,
        transition: 'box-shadow 0.15s',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: isRed ? '#fee2e2' : '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: isRed ? '#dc2626' : '#475569',
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: isRed ? '#dc2626' : '#0f172a',
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16 }: { width?: number | string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 4,
        background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }}
    />
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const col = createColumnHelper<PriceRow>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<PriceRow, any>[] = [
  col.accessor('product', {
    header: 'Producto',
    cell: ({ getValue, row }) => (
      <div>
        <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 13 }}>{getValue()}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{row.original.sku}</div>
      </div>
    ),
  }),
  col.accessor('retailer', {
    header: 'Retailer',
    cell: ({ getValue }) => (
      <span style={{ fontSize: 13, color: '#334155' }}>{getValue()}</span>
    ),
  }),
  col.accessor('lastPrice', {
    header: 'Último precio',
    cell: ({ getValue }) => (
      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtARS(getValue())}</span>
    ),
  }),
  col.accessor('targetPrice', {
    header: 'Precio objetivo',
    cell: ({ getValue }) => (
      <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b' }}>
        {fmtARS(getValue())}
      </span>
    ),
  }),
  col.accessor('diffPercent', {
    header: 'Diferencia %',
    cell: ({ getValue }) => <DiffCell value={getValue()} />,
  }),
  col.accessor('status', {
    header: 'Estado',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
  col.accessor('lastCapture', {
    header: 'Última captura',
    cell: ({ getValue }) => (
      <span
        title={new Date(getValue()).toLocaleString('es-AR')}
        style={{ fontSize: 12, color: '#94a3b8' }}
      >
        {fmtRelative(getValue())}
      </span>
    ),
  }),
];

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const [rows, setRows]             = useState<PriceRow[]>([]);
  const [summary, setSummary]       = useState<DashboardSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sorting, setSorting]       = useState<SortingState>([]);
  const [filters, setFilters]       = useState<DashboardFilters>({ product: 'all', status: 'all' });

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else { setLoading(true); setError(null); }
    try {
      const [r, s] = await Promise.all([fetchPriceRows(), fetchDashboardSummary()]);
      setRows(r);
      setSummary(s);
    } catch {
      setError('No se pudieron cargar los datos. Verificá la conexión con el servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const products = useMemo(() => getUniqueProducts(rows), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filters.product === 'all' || r.product === filters.product) &&
          (filters.status  === 'all' || r.status  === filters.status),
      ),
    [rows, filters],
  );

  const table = useReactTable({
    data: filtered,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <style>{`
        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes spin    { to { transform: rotate(360deg); }    }
        .dash-th { user-select: none; }
        .dash-th:hover { background: #f1f5f9 !important; }
        .dash-row:hover td { background: #f8fafc; }
        .btn-refresh:hover { background: #f1f5f9 !important; }
        .filter-sel:focus {
          outline: none;
          border-color: #D71920 !important;
          box-shadow: 0 0 0 2px rgba(215,25,32,0.15);
        }
      `}</style>

      <div
        style={{
          padding: '28px 32px',
          minHeight: '100vh',
          background: '#f8fafc',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 28,
          }}
        >
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
              Dashboard de Precios
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Monitoreo consolidado por retailer · vista en tiempo real
            </p>
          </div>

          <button
            className="btn-refresh"
            onClick={() => load(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#475569',
              fontSize: 13,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}
            />
            Actualizar
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: '10px 16px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* ── Summary cards ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 14,
            marginBottom: 28,
          }}
        >
          {loading || !summary ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} height={80} />)
          ) : (
            <>
              <SummaryCard
                icon={<Store size={18} />}
                label="Retailers monitoreados"
                value={summary.totalRetailers}
              />
              <SummaryCard
                icon={<Bell size={18} />}
                label="Alertas activas"
                value={summary.activeAlerts}
                danger
              />
              <SummaryCard
                icon={<Camera size={18} />}
                label="Capturas últimas 24h"
                value={summary.capturesLast24h}
              />
              <SummaryCard
                icon={<ShieldAlert size={18} />}
                label="Alertas críticas abiertas"
                value={summary.criticalOpenAlerts}
                danger
              />
            </>
          )}
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {(['product', 'status'] as const).map((key) => (
            <select
              key={key}
              className="filter-sel"
              value={filters[key]}
              onChange={(e) =>
                setFilters((f) => ({ ...f, [key]: e.target.value as FilterStatus }))
              }
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#334155',
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 168,
                transition: 'border-color 0.15s',
              }}
            >
              {key === 'product' ? (
                <>
                  <option value="all">Todos los productos</option>
                  {products.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </>
              ) : (
                <>
                  <option value="all">Todos los estados</option>
                  <option value="ok">OK</option>
                  <option value="warning">Alerta</option>
                  <option value="critical">Crítico</option>
                  <option value="unknown">Sin datos</option>
                </>
              )}
            </select>
          ))}
        </div>

        {/* ── Table ── */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              {table.getHeaderGroups().map((hg: HeaderGroup<PriceRow>) => (
                <tr key={hg.id}>
                  {hg.headers.map((header: Header<PriceRow, unknown>) => (
                    <th
                      key={header.id}
                      className="dash-th"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#94a3b8',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  ? <ChevronUp size={11} />
                        : header.column.getIsSorted() === 'desc' ? <ChevronDown size={11} />
                        : <ChevronsUpDown size={10} style={{ opacity: 0.3 }} />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {COLUMNS.map((_, j) => (
                      <td key={j} style={{ padding: '12px 14px' }}>
                        <Skeleton width={j === 0 ? 110 : 72} height={14} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    style={{ textAlign: 'center', padding: '52px 20px', color: '#94a3b8' }}
                  >
                    <AlertTriangle size={22} style={{ display: 'block', margin: '0 auto 8px' }} />
                    Sin resultados para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row: Row<PriceRow>) => (
                  <tr
                    key={row.id}
                    className="dash-row"
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                  >
                    {row.getVisibleCells().map((cell: Cell<PriceRow, unknown>) => (
                      <td key={cell.id} style={{ padding: '11px 14px', verticalAlign: 'middle' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Row count ── */}
        {!loading && rows.length > 0 && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, textAlign: 'right' }}>
            {filtered.length} de {rows.length} registros
          </p>
        )}
      </div>
    </>
  );
}
