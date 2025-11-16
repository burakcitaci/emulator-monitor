import type { ColumnSort, Row, RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: TData is used in the TableMeta interface
  // biome-ignore lint/@typescript-eslint/no-unused-vars: TData is used in the TableMeta interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    queryKeys?: QueryKeys;
  }

  // biome-ignore lint/correctness/noUnusedVariables: TData and TValue are used in the ColumnMeta interface
  // biome-ignore lint/@typescript-eslint/no-unused-vars: TData and TValue are used in the ColumnMeta interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    options?: Option[];
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  }
}

export interface QueryKeys {
  page: string;
  perPage: string;
  sort: string;
  filters: string;
  joinOperator: string;
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type FilterOperator = "iLike" | "notILike" | "eq" | "ne" | "inArray" | "notInArray" | "isEmpty" | "isNotEmpty" | "lt" | "lte" | "gt" | "gte" | "isBetween" | "isRelativeToToday";

export type FilterVariant = "text" | "number" | "range" | "date" | "dateRange" | "boolean" | "select" | "multiSelect";

export type JoinOperator = "and" | "or";

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, "id"> {
  id: Extract<keyof TData, string>;
}

export interface ExtendedColumnFilter<TData> {
  id: Extract<keyof TData, string>;
  value: string | string[];
  variant: FilterVariant;
  operator: FilterOperator;
  filterId: string;
}

export interface DataTableRowAction<TData> {
  row: Row<TData>;
  variant: "update" | "delete";
}
