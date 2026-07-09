import ExcelJS from "exceljs"

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

export async function exportToExcel<T>(rows: T[], columns: ExportColumn<T>[], fileName: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Data")

  sheet.columns = columns.map((col) => ({ header: col.header, width: 22 }))
  sheet.getRow(1).font = { bold: true }

  for (const row of rows) {
    sheet.addRow(columns.map((col) => col.value(row) ?? ""))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${fileName}.xlsx`
  )
}

export function exportToCsv<T>(rows: T[], columns: ExportColumn<T>[], fileName: string) {
  const escape = (value: string | number | null | undefined) => {
    const str = String(value ?? "")
    return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
  }

  const lines = [
    columns.map((col) => escape(col.header)).join(","),
    ...rows.map((row) => columns.map((col) => escape(col.value(row))).join(",")),
  ]

  // BOM so Excel opens Arabic/UTF-8 text correctly
  downloadBlob(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${fileName}.csv`)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
