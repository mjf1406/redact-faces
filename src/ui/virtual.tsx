import type { ReactNode } from 'react';
import { Grid, List, type CellComponentProps, type RowComponentProps } from 'react-window';

type ListData = {
  items: readonly unknown[];
  render: (item: unknown, index: number) => ReactNode;
};

function ListRow({ index, style, items, render }: RowComponentProps<ListData>) {
  return <div style={style}>{render(items[index], index)}</div>;
}

export function VirtualRows<T>({
  items,
  rowHeight,
  height,
  children,
}: {
  items: readonly T[];
  rowHeight: number;
  height: number;
  children: (item: T, index: number) => ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing to show.</p>;
  return (
    <List
      rowCount={items.length}
      rowHeight={rowHeight}
      rowComponent={ListRow}
      rowProps={{ items, render: children as ListData['render'] }}
      style={{ height, width: '100%' }}
      overscanCount={4}
    />
  );
}

type GridData = {
  items: readonly unknown[];
  columns: number;
  render: (item: unknown) => ReactNode;
};

function GridCell({
  columnIndex,
  rowIndex,
  style,
  items,
  columns,
  render,
}: CellComponentProps<GridData>) {
  const item = items[rowIndex * columns + columnIndex];
  if (!item) return <div style={style} />;
  return <div style={style}>{render(item)}</div>;
}

export function VirtualGrid<T>({
  items,
  height,
  width,
  columnWidth,
  rowHeight,
  children,
}: {
  items: readonly T[];
  height: number;
  width: number;
  columnWidth: number;
  rowHeight: number;
  children: (item: T) => ReactNode;
}) {
  const columns = Math.max(1, Math.floor(width / columnWidth));
  return (
    <Grid
      columnCount={columns}
      columnWidth={columnWidth}
      rowCount={Math.max(1, Math.ceil(items.length / columns))}
      rowHeight={rowHeight}
      cellComponent={GridCell}
      cellProps={{ items, columns, render: children as GridData['render'] }}
      style={{ height, width }}
      overscanCount={2}
    />
  );
}
