/**
 * @file Budget vs Actual cost breakdown — project selector + bar chart + grid
 * @module vimber-client/pages/Reports/CostBreakdownPage
 *
 * Implements PRD §3.10.6 — per-project cost breakdown by category.
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { BarChart } from '@mui/x-charts/BarChart';

import CurrencyCell from '../../components/shared/CurrencyCell.jsx';
import ReportTablePage from '../../components/shared/ReportTablePage.jsx';
import { useProjects } from '../../hooks/useProjects.js';
import { useCostBreakdown } from '../../hooks/useReports.js';
import { chartContainerSx } from '../../config/layoutTokens.js';

const columns = [
  { field: 'category_code', headerName: 'Code', width: 100 },
  { field: 'category_name', headerName: 'Category', flex: 1, minWidth: 180 },
  { field: 'category_type', headerName: 'Type', width: 120 },
  { field: 'budgeted_amount', headerName: 'Budgeted', width: 140, renderCell: (params) => <CurrencyCell value={params.value} /> },
  { field: 'actual_amount', headerName: 'Actual', width: 140, renderCell: (params) => <CurrencyCell value={params.value} /> },
  { field: 'variance', headerName: 'Variance', width: 140, renderCell: (params) => <CurrencyCell value={params.value} variance /> },
];

export default function CostBreakdownPage() {
  const { data: projRes } = useProjects({ limit: 500 });
  const projects = projRes?.rows ?? [];

  const [projectId, setProjectId] = useState('');
  const { data: rows = [], isLoading, isError, error } = useCostBreakdown(projectId);

  const chartLabels = useMemo(() => rows.map((r) => r.category_code || r.category_name || ''), [rows]);
  const budgetData = useMemo(() => rows.map((r) => Number(r.budgeted_amount || 0)), [rows]);
  const actualData = useMemo(() => rows.map((r) => Number(r.actual_amount || 0)), [rows]);

  const headerContent = (
    <>
      <TextField
        select
        label="Select Project"
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        sx={{ minWidth: 300, mb: 2 }}
        size="small"
      >
        <MenuItem value="">— Select —</MenuItem>
        {projects.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.project_code} — {p.project_name || p.name}
          </MenuItem>
        ))}
      </TextField>

      {rows.length > 0 && (
        <Box sx={chartContainerSx}>
          <BarChart
            xAxis={[{ data: chartLabels, scaleType: 'band' }]}
            series={[
              { data: budgetData, label: 'Budgeted', color: '#2196f3' },
              { data: actualData, label: 'Actual', color: '#ff9800' },
            ]}
            height={280}
          />
        </Box>
      )}
    </>
  );

  return (
    <ReportTablePage
      title="Budget vs Actual"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.category_code || `${r.category_name}-${r.category_type}`}
      loading={isLoading}
      error={isError ? error : null}
      headerContent={headerContent}
      dataGridProps={{ pageSizeOptions: [25, 50] }}
    />
  );
}
