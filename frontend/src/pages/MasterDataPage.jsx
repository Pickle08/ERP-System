import { useState } from "react";
import {
    keepPreviousData,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import CrudFormDialog from "../components/master/CrudFormDialog";
import { useToast } from "../components/toast/useToast";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import DataTable from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Pagination from "../components/ui/Pagination";
import SearchInput from "../components/ui/SearchInput";
import { useListParams } from "../hooks/useListParams";
import { inputClass } from "../lib/ui";

export default function MasterDataPage({ config }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const canWrite = config.writeRoles.includes(user.role);

    const { page, get, update, reset, hasFilters } = useListParams();
    const [resetKey, setResetKey] = useState(0);
    const [form, setForm] = useState(null); // { row } untuk ubah, {} untuk tambah
    const [removing, setRemoving] = useState(null);

    const active = get("is_active");
    const params = {
        page,
        per_page: 15,
        search: get("search") || undefined,
        is_active: active === "" ? undefined : active,
    };

    const list = useQuery({
        queryKey: [config.key, params],
        queryFn: () => config.api.list(params),
        placeholderData: keepPreviousData,
    });

    const refresh = () => {
        for (const key of [config.key, ...(config.invalidate ?? [])])
            queryClient.invalidateQueries({ queryKey: [key] });
    };

    const columns = [
        ...config.columns,
        ...(canWrite
            ? [
                  {
                      key: "actions",
                      header: "",
                      align: "right",
                      cell: (row) => (
                          <div className="flex justify-end gap-3 whitespace-nowrap text-xs font-medium">
                              <button
                                  onClick={() => setForm({ row })}
                                  className="text-indigo-600 hover:underline">
                                  Ubah
                              </button>
                              <button
                                  onClick={() => setRemoving(row)}
                                  className="text-red-600 hover:underline">
                                  Hapus
                              </button>
                          </div>
                      ),
                  },
              ]
            : []),
    ];

    const handleReset = () => {
        reset();
        setResetKey((key) => key + 1);
    };

    return (
        <>
            <PageHeader
                title={config.title}
                description={config.description}
                actions={
                    canWrite && (
                        <button
                            onClick={() => setForm({})}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                            + Tambah {config.singular}
                        </button>
                    )
                }
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="sm:w-72">
                    <SearchInput
                        key={resetKey}
                        defaultValue={get("search")}
                        onSearch={(value) => update({ search: value })}
                        placeholder={config.searchPlaceholder}
                    />
                </div>

                {config.activeFilter && (
                    <select
                        value={active}
                        onChange={(e) => update({ is_active: e.target.value })}
                        className={`${inputClass()} bg-white sm:w-44`}>
                        <option value="">Aktif dan nonaktif</option>
                        <option value="1">Aktif saja</option>
                        <option value="0">Nonaktif saja</option>
                    </select>
                )}

                {hasFilters && (
                    <button
                        onClick={handleReset}
                        className="text-sm text-indigo-600 hover:underline">
                        Reset filter
                    </button>
                )}
            </div>

            <DataTable
                columns={columns}
                rows={list.data?.data ?? []}
                isLoading={list.isLoading}
                isFetching={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                emptyMessage={
                    hasFilters
                        ? "Tidak ada data yang cocok dengan filter."
                        : `Belum ada ${config.singular.toLowerCase()}.`
                }
            />

            <Pagination
                meta={list.data?.meta}
                onPageChange={(next) => update({ page: next })}
            />

            {form && (
                <CrudFormDialog
                    config={config}
                    row={form.row}
                    onClose={() => setForm(null)}
                />
            )}

            {removing && (
                <ConfirmDialog
                    title={`Hapus ${config.singular.toLowerCase()}`}
                    description={config.deleteDescription(removing)}
                    confirmLabel="Hapus"
                    mutationFn={() => config.api.remove(removing.id)}
                    onSuccess={() => {
                        refresh();
                        toast.success(`${config.singular} dihapus.`);
                    }}
                    onClose={() => setRemoving(null)}
                />
            )}
        </>
    );
}
