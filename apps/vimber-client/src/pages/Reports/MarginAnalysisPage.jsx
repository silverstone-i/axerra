/**
 * @file Margin analysis report — sortable DataGrid with profitability metrics
 * @module vimber-client/pages/Reports/MarginAnalysisPage
 *
 * Implements PRD §3.10.6 — margin analysis with server-side sort via API params.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState } from 'react';

import PercentCell from '../../components/shared/PercentCell.jsx';
import ReportTablePage from '../../components/shared/ReportTablePage.jsx';
import { useMarginAnalysis } from '../../hooks/useReports.js';
import { statusColumn, currencyColumn } from '../../utils/columnHelpers.jsx';

const SORT_FIELDS = new Set([
  'project_code',
  'project_name',
  'invoiced_revenue',
  'committed_cost',
  'gross_profit',
  'gross_margin_pct',
  'net_cashflow',
  'budget_variance',
]);

const columns = [
  { field: 'project_code', headerName: 'Code', width: 120 },
  { field: 'project_name', headerName: 'Project', flex: 1, minWidth: 180 },
  statusColumn('project_status', 'Status', { sortable: false, hideEmpty: true }),
  currencyColumn('invoiced_revenue', 'Revenue'),
  currencyColumn('committed_cost', 'Committed Cost'),
  currencyColumn('gross_profit', 'Gross Profit', { variance: true }),
  { field: 'gross_margin_pct', headerName: 'Margin %', width: 110, renderCell: (params) => <PercentCell value={params.value} /> },
  currencyColumn('net_cashflow', 'Net Cashflow', { variance: true }),
  currencyColumn('budget_variance', 'Budget Var.', { variance: true }),
];

export default function MarginAnalysisPage() {
  const [sortModel, setSortModel] = useState([{ field: 'gross_margin_pct', sort: 'desc' }]);

  const sortBy = sortModel[0]?.field || 'gross_margin_pct';
  const sortDir = (sortModel[0]?.sort || 'desc').toUpperCase();
  const apiParams = SORT_FIELDS.has(sortBy) ? { sortBy, sortDir } : {};

  const { data: rows = [], isLoading, isError, error } = useMarginAnalysis(apiParams);

  return (
    <ReportTablePage
      title="Margin Analysis"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.project_id || r.project_code}
      loading={isLoading}
      error={isError ? error : null}
      dataGridProps={{
        sortingMode: 'server',
        sortModel,
        onSortModelChange: setSortModel,
      }}
    />
  );
}
